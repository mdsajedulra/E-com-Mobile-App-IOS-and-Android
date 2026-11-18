<?php
/**
 * GET /storeapp/v1/config: everything the app needs to dress itself as this store.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class StoreApp_Config {

	public static function init() {
		add_action( 'rest_api_init', array( __CLASS__, 'routes' ) );
		foreach ( array( 'customize_save_after', 'elementor/editor/after_save', 'switch_theme', 'woocommerce_settings_saved', 'created_product_cat', 'edited_product_cat', 'delete_product_cat' ) as $h ) {
			add_action( $h, array( __CLASS__, 'bump' ) );
		}
		add_action( 'updated_option', function ( $name ) {
			if ( 0 === strpos( $name, 'bdsa' ) || 0 === strpos( $name, 'theme_mods_' ) || 0 === strpos( $name, 'astra-settings' )
				|| in_array( $name, array( 'blogname', 'blogdescription', 'site_icon', 'woocommerce_currency', 'woocommerce_email_base_color', 'woocommerce_enable_guest_checkout', 'elementor_active_kit' ), true ) ) {
				StoreApp_Config::bump();
			}
		} );
	}

	public static function bump() {
		update_option( 'storeapp_config_version', time(), false );
	}

	public static function routes() {
		register_rest_route( STOREAPP_NS, '/config', array(
			'methods'             => 'GET',
			'callback'            => array( __CLASS__, 'get' ),
			'permission_callback' => '__return_true',
		) );
		register_rest_route( STOREAPP_NS, '/categories', array(
			'methods'             => 'GET',
			'callback'            => array( __CLASS__, 'categories' ),
			'permission_callback' => '__return_true',
		) );
	}

	public static function get() {
		$s       = StoreApp_Settings::all();
		$version = (string) get_option( 'storeapp_config_version', '1' );
		$cache   = get_transient( 'storeapp_config' );
		if ( is_array( $cache ) && isset( $cache['version'] ) && $cache['version'] === $version . '-' . STOREAPP_VERSION ) {
			return rest_ensure_response( $cache );
		}

		$data = array(
			'version'  => $version . '-' . STOREAPP_VERSION,
			'site'     => self::site( $s ),
			'theme'    => StoreApp_Branding::theme(),
			'features' => array(
				'registration'   => StoreApp_Settings::on( 'registration' ),
				'guest_checkout' => 'yes' === get_option( 'woocommerce_enable_guest_checkout', 'yes' ),
				'wishlist'       => StoreApp_Settings::on( 'wishlist' ),
				'reviews'        => StoreApp_Settings::on( 'reviews' ) && 'yes' === get_option( 'woocommerce_enable_reviews', 'yes' ),
				'coupons'        => StoreApp_Settings::on( 'coupons' ) && wc_coupons_enabled(),
				'language'       => in_array( $s['language'], array( 'en', 'bn' ), true ) ? $s['language'] : 'en',
			),
			'home'     => self::home( $s ),
			'contact'  => array(
				'phone'    => $s['phone'] ? $s['phone'] : get_option( 'woocommerce_store_phone', '' ),
				'whatsapp' => $s['whatsapp'],
				'email'    => $s['email'] ? $s['email'] : get_option( 'woocommerce_email_from_address', get_option( 'admin_email' ) ),
				'facebook' => $s['facebook'],
				'address'  => trim( implode( ', ', array_filter( array( get_option( 'woocommerce_store_address' ), get_option( 'woocommerce_store_city' ) ) ) ) ),
			),
			'pages'    => self::pages(),
			'checkout' => self::checkout(),
			'payments' => self::payments(),
		);
		$data = apply_filters( 'storeapp_config', $data );
		set_transient( 'storeapp_config', $data, 6 * HOUR_IN_SECONDS );
		return rest_ensure_response( $data );
	}

	private static function site( $s ) {
		$name = $s['app_name'] ? $s['app_name'] : html_entity_decode( get_bloginfo( 'name' ), ENT_QUOTES );
		return array(
			'name'     => $name,
			'tagline'  => html_entity_decode( get_bloginfo( 'description' ), ENT_QUOTES ),
			'url'      => home_url( '/' ),
			'logo'     => StoreApp_Branding::logo_url(),
			'icon'     => get_site_icon_url( 1024 ),
			'currency' => array(
				'code'      => get_woocommerce_currency(),
				'symbol'    => html_entity_decode( get_woocommerce_currency_symbol(), ENT_QUOTES ),
				'position'  => get_option( 'woocommerce_currency_pos', 'left' ),
				'decimals'  => wc_get_price_decimals(),
				'thousand'  => wc_get_price_thousand_separator(),
				'decimal'   => wc_get_price_decimal_separator(),
			),
			'locale'   => get_locale(),
		);
	}

	private static function link( $type, $value ) {
		$type  = in_array( $type, array( 'product', 'category', 'url', 'search', 'none' ), true ) ? $type : 'none';
		$value = (string) $value;
		return array( 'type' => $type, 'value' => $value );
	}

	private static function home( $s ) {
		$sections = array();

		if ( $s['notice'] ) {
			$sections[] = array( 'type' => 'notice', 'text' => wp_strip_all_tags( $s['notice'] ) );
		}

		$banners = array();
		foreach ( (array) $s['banners'] as $b ) {
			$img = ! empty( $b['image_id'] ) ? wp_get_attachment_image_url( (int) $b['image_id'], 'large' ) : '';
			if ( $img ) {
				$banners[] = array(
					'image' => $img,
					'link'  => self::link( isset( $b['link_type'] ) ? $b['link_type'] : 'none', isset( $b['link_value'] ) ? $b['link_value'] : '' ),
				);
			}
		}

		$configured = array_values( array_filter( (array) $s['sections'], function ( $x ) {
			return ! empty( $x['type'] );
		} ) );

		if ( ! $configured ) {
			// Sensible automatic home page.
			$configured = array(
				array( 'type' => 'banners' ),
				array( 'type' => 'categories', 'title' => __( 'Shop by category', 'storeapp' ) ),
				array( 'type' => 'products', 'title' => __( 'New arrivals', 'storeapp' ), 'source' => 'latest', 'limit' => 10 ),
				array( 'type' => 'products', 'title' => __( 'On sale', 'storeapp' ), 'source' => 'sale', 'limit' => 10 ),
				array( 'type' => 'products', 'title' => __( 'Best sellers', 'storeapp' ), 'source' => 'popular', 'limit' => 10 ),
				array( 'type' => 'products', 'title' => __( 'Featured', 'storeapp' ), 'source' => 'featured', 'limit' => 10 ),
			);
			// Add a grid of each top-level category with products.
			$terms = get_terms( array( 'taxonomy' => 'product_cat', 'parent' => 0, 'hide_empty' => true, 'number' => 4, 'orderby' => 'count', 'order' => 'DESC', 'exclude' => array( (int) get_option( 'default_product_cat' ) ) ) );
			foreach ( is_array( $terms ) ? $terms : array() as $t ) {
				$configured[] = array( 'type' => 'products', 'title' => html_entity_decode( $t->name ), 'source' => 'category', 'category' => $t->term_id, 'limit' => 10 );
			}
		}

		foreach ( $configured as $sec ) {
			$type = $sec['type'];
			if ( 'banners' === $type ) {
				if ( $banners ) {
					$sections[] = array( 'type' => 'banners', 'items' => $banners );
				}
			} elseif ( 'categories' === $type ) {
				$sections[] = array( 'type' => 'categories', 'title' => isset( $sec['title'] ) ? $sec['title'] : '' );
			} elseif ( 'products' === $type ) {
				$source = isset( $sec['source'] ) ? $sec['source'] : 'latest';
				$query  = array( 'per_page' => max( 2, min( 20, (int) ( isset( $sec['limit'] ) ? $sec['limit'] : 10 ) ) ) );
				switch ( $source ) {
					case 'sale':
						$query['on_sale'] = true;
						break;
					case 'featured':
						$query['featured'] = true;
						break;
					case 'popular':
						$query['orderby'] = 'popularity';
						$query['order']   = 'desc';
						break;
					case 'rating':
						$query['orderby'] = 'rating';
						$query['order']   = 'desc';
						break;
					case 'category':
						$query['category'] = (string) (int) ( isset( $sec['category'] ) ? $sec['category'] : 0 );
						break;
					default:
						$query['orderby'] = 'date';
						$query['order']   = 'desc';
				}
				$sections[] = array(
					'type'   => 'products',
					'title'  => isset( $sec['title'] ) ? $sec['title'] : '',
					'layout' => isset( $sec['layout'] ) && 'grid' === $sec['layout'] ? 'grid' : 'carousel',
					'query'  => $query,
					'link'   => 'category' === $source ? self::link( 'category', (string) $query['category'] ) : self::link( 'search', wp_json_encode( $query ) ),
				);
			}
		}
		return array( 'sections' => $sections );
	}

	private static function pages() {
		$out   = array();
		$map   = array(
			'privacy' => (int) get_option( 'wp_page_for_privacy_policy' ),
			'terms'   => (int) wc_terms_and_conditions_page_id(),
		);
		foreach ( $map as $k => $id ) {
			if ( $id && 'publish' === get_post_status( $id ) ) {
				$out[] = array( 'key' => $k, 'title' => get_the_title( $id ), 'url' => get_permalink( $id ) );
			}
		}
		// Common store pages by slug.
		foreach ( array( 'about' => array( 'about', 'about-us' ), 'refund' => array( 'refund-policy', 'return-policy', 'refund_returns', 'returns' ), 'contact' => array( 'contact', 'contact-us' ), 'faq' => array( 'faq', 'faqs' ) ) as $k => $slugs ) {
			foreach ( $slugs as $slug ) {
				$p = get_page_by_path( $slug );
				if ( $p && 'publish' === $p->post_status ) {
					$out[] = array( 'key' => $k, 'title' => get_the_title( $p ), 'url' => get_permalink( $p ) );
					break;
				}
			}
		}
		return apply_filters( 'storeapp_pages', $out );
	}

	/**
	 * Checkout fields exactly as the site defines them (after every plugin filter),
	 * so the app form matches the website's checkout.
	 */
	public static function checkout() {
		$fields = array();
		$std    = array( 'first_name', 'last_name', 'company', 'address_1', 'address_2', 'city', 'state', 'postcode', 'country', 'email', 'phone' );

		if ( ! WC()->session && class_exists( 'WC_Session_Handler' ) ) {
			WC()->session = new WC_Session_Handler();
			WC()->session->init();
		}
		if ( ! WC()->customer ) {
			WC()->customer = new WC_Customer( 0, true );
		}

		$billing = WC()->checkout()->get_checkout_fields( 'billing' );
		uasort( $billing, function ( $a, $b ) {
			return ( isset( $a['priority'] ) ? $a['priority'] : 50 ) <=> ( isset( $b['priority'] ) ? $b['priority'] : 50 );
		} );
		foreach ( $billing as $key => $f ) {
			$name = preg_replace( '/^billing_/', '', $key );
			$fields[] = array(
				'key'         => $name,
				'standard'    => in_array( $name, $std, true ),
				'label'       => wp_strip_all_tags( isset( $f['label'] ) ? $f['label'] : $name ),
				'placeholder' => wp_strip_all_tags( isset( $f['placeholder'] ) ? $f['placeholder'] : '' ),
				'type'        => isset( $f['type'] ) ? $f['type'] : 'text',
				'required'    => ! empty( $f['required'] ),
				'options'     => ( isset( $f['options'] ) && is_array( $f['options'] ) && 'state' !== ( isset( $f['type'] ) ? $f['type'] : '' ) ) ? self::options( $f['options'] ) : null,
				'default'     => isset( $f['default'] ) ? (string) $f['default'] : '',
			);
		}

		$allowed = WC()->countries->get_allowed_countries();
		$default = wc_get_base_location();
		$states  = array();
		foreach ( array_keys( $allowed ) as $cc ) {
			$st = WC()->countries->get_states( $cc );
			if ( is_array( $st ) && $st ) {
				$states[ $cc ] = self::options( $st );
			}
		}

		$order_notes = WC()->checkout()->get_checkout_fields( 'order' );
		$cities      = self::cities();
		if ( count( (array) $cities ) ) {
			// Per-state city lists replace the long flat list.
			foreach ( $fields as &$fl ) {
				if ( 'city' === $fl['key'] ) {
					$fl['options'] = null;
					$fl['type']    = 'city';
				}
			}
			unset( $fl );
		}

		$out = array(
			'fields'         => $fields,
			'countries'      => self::options( $allowed ),
			'default_country'=> $default['country'],
			'states'         => $states,
			'order_notes'    => ! empty( $order_notes ),
			'email_required' => self::email_required( $billing ),
			'cities'         => $cities,
			'terms_url'      => wc_terms_and_conditions_page_id() ? get_permalink( wc_terms_and_conditions_page_id() ) : '',
		);
		return apply_filters( 'storeapp_checkout_config', $out );
	}

	public static function email_required( $billing = null ) {
		$mode = StoreApp_Settings::get( 'email_optional' );
		if ( 'yes' === $mode ) {
			return false;
		}
		if ( 'no' === $mode ) {
			return true;
		}
		if ( null === $billing ) {
			$billing = WC()->checkout()->get_checkout_fields( 'billing' );
		}
		return isset( $billing['billing_email'] ) && ! empty( $billing['billing_email']['required'] );
	}

	private static function options( $opts ) {
		$out = array();
		foreach ( (array) $opts as $k => $v ) {
			if ( '' === (string) $k ) {
				continue;
			}
			$out[] = array( 'value' => (string) $k, 'label' => html_entity_decode( wp_strip_all_tags( (string) $v ), ENT_QUOTES ) );
		}
		return $out;
	}

	/**
	 * City/thana lists per state. Integrates BD Smart Address when active.
	 * Shape: { "BD-13": [ {value, label}, ... ] }
	 */
	private static function cities() {
		$out = array();
		if ( class_exists( 'BDSA_Geo' ) && method_exists( 'BDSA_Geo', 'frontend_map' ) && method_exists( 'BDSA_Geo', 'district_from_wc_state' ) ) {
			$bn    = class_exists( 'BDSA_Plugin' ) && 'bn' === BDSA_Plugin::get( 'language' );
			$map   = BDSA_Geo::frontend_map();
			$by_di = array();
			foreach ( (array) $map as $i => $d ) {
				$by_di[ $i ] = $d;
			}
			foreach ( (array) WC()->countries->get_states( 'BD' ) as $code => $label ) {
				$di = BDSA_Geo::district_from_wc_state( $label );
				if ( null === $di || false === $di || ! isset( $by_di[ $di ] ) ) {
					// Try by English name.
					foreach ( $by_di as $i => $d ) {
						if ( 0 === strcasecmp( $d['n'], $label ) || ( isset( $d['b'] ) && $d['b'] === $label ) ) {
							$di = $i;
							break;
						}
					}
				}
				if ( null === $di || false === $di || ! isset( $by_di[ $di ] ) ) {
					continue;
				}
				$list = array();
				foreach ( (array) $by_di[ $di ]['t'] as $t ) {
					$list[] = array( 'value' => $t[0], 'label' => $bn && ! empty( $t[1] ) ? $t[1] : $t[0] );
				}
				$out[ $code ] = $list;
			}
		}
		return apply_filters( 'storeapp_cities', (object) $out );
	}

	private static function payments() {
		$out = array();
		foreach ( WC()->payment_gateways()->payment_gateways() as $id => $g ) {
			if ( 'yes' !== $g->enabled ) {
				continue;
			}
			$icon = method_exists( $g, 'get_icon' ) ? $g->get_icon() : '';
			preg_match( '/src=["\']([^"\']+)/', (string) $icon, $m );
			$out[] = array(
				'id'          => $id,
				'title'       => wp_strip_all_tags( $g->get_title() ),
				'description' => wp_strip_all_tags( $g->get_description() ),
				'icon'        => isset( $m[1] ) ? $m[1] : '',
				// Gateways without a native app flow open their payment page in a secure in-app browser.
				'flow'        => in_array( $id, array( 'cod', 'bacs', 'cheque' ), true ) ? 'offline' : 'redirect',
			);
		}
		return $out;
	}

	public static function categories() {
		$terms = get_terms( array(
			'taxonomy'   => 'product_cat',
			'hide_empty' => true,
			'orderby'    => 'menu_order',
			'exclude'    => array( (int) get_option( 'default_product_cat' ) ),
		) );
		$out = array();
		foreach ( is_array( $terms ) ? $terms : array() as $t ) {
			$thumb = (int) get_term_meta( $t->term_id, 'thumbnail_id', true );
			$img   = $thumb ? wp_get_attachment_image_url( $thumb, 'medium' ) : '';
			if ( ! $img ) {
				// Fall back to a product image from the category.
				$p = wc_get_products( array( 'category' => array( $t->slug ), 'limit' => 1, 'status' => 'publish', 'return' => 'ids' ) );
				$img = $p ? get_the_post_thumbnail_url( $p[0], 'medium' ) : '';
			}
			$out[] = array(
				'id'     => $t->term_id,
				'name'   => html_entity_decode( $t->name, ENT_QUOTES ),
				'slug'   => $t->slug,
				'parent' => $t->parent,
				'count'  => (int) $t->count,
				'image'  => $img ? $img : '',
			);
		}
		return rest_ensure_response( $out );
	}
}
