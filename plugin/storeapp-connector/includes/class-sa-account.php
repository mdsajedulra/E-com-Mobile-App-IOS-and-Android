<?php
/**
 * Customer account: profile, addresses, password, account deletion (required by Apple),
 * own orders, guest order tracking.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class StoreApp_Account {

	public static function init() {
		add_action( 'rest_api_init', array( __CLASS__, 'routes' ) );
	}

	public static function logged_in() {
		return is_user_logged_in() ? true : new WP_Error( 'storeapp_auth', __( 'Please log in.', 'storeapp' ), array( 'status' => 401 ) );
	}

	public static function routes() {
		$auth = array( __CLASS__, 'logged_in' );
		register_rest_route( STOREAPP_NS, '/me', array(
			array( 'methods' => 'GET', 'callback' => array( __CLASS__, 'me' ), 'permission_callback' => $auth ),
			array( 'methods' => 'POST', 'callback' => array( __CLASS__, 'update_me' ), 'permission_callback' => $auth ),
			array( 'methods' => 'DELETE', 'callback' => array( __CLASS__, 'delete_me' ), 'permission_callback' => $auth ),
		) );
		register_rest_route( STOREAPP_NS, '/me/password', array(
			'methods'             => 'POST',
			'callback'            => array( __CLASS__, 'password' ),
			'permission_callback' => $auth,
		) );
		register_rest_route( STOREAPP_NS, '/orders', array(
			'methods'             => 'GET',
			'callback'            => array( __CLASS__, 'orders' ),
			'permission_callback' => $auth,
		) );
		register_rest_route( STOREAPP_NS, '/orders/(?P<id>\d+)', array(
			'methods'             => 'GET',
			'callback'            => array( __CLASS__, 'order' ),
			'permission_callback' => '__return_true',
		) );
		register_rest_route( STOREAPP_NS, '/orders/(?P<id>\d+)/cancel', array(
			'methods'             => 'POST',
			'callback'            => array( __CLASS__, 'cancel' ),
			'permission_callback' => $auth,
		) );
		register_rest_route( STOREAPP_NS, '/track', array(
			'methods'             => 'POST',
			'callback'            => array( __CLASS__, 'track' ),
			'permission_callback' => '__return_true',
		) );
	}

	/* ---------------- Payloads ---------------- */

	public static function address( $customer_or_order, $type ) {
		$keys = array( 'first_name', 'last_name', 'company', 'address_1', 'address_2', 'city', 'state', 'postcode', 'country', 'phone', 'email' );
		$out  = array();
		foreach ( $keys as $k ) {
			$getter = "get_{$type}_{$k}";
			$out[ $k ] = is_callable( array( $customer_or_order, $getter ) ) ? (string) $customer_or_order->$getter() : '';
		}
		return $out;
	}

	public static function user_payload( WP_User $user ) {
		$c = new WC_Customer( $user->ID );
		return array(
			'id'           => $user->ID,
			'name'         => $user->display_name,
			'first_name'   => $user->first_name,
			'last_name'    => $user->last_name,
			'email'        => $user->user_email,
			'phone'        => $c->get_billing_phone(),
			'avatar'       => get_avatar_url( $user->ID, array( 'size' => 160, 'default' => 'mp' ) ),
			'billing'      => self::address( $c, 'billing' ),
			'shipping'     => self::address( $c, 'shipping' ),
			'orders_count' => (int) $c->get_order_count(),
		);
	}

	private static function money( $amount ) {
		return wc_format_decimal( $amount, wc_get_price_decimals() );
	}

	public static function order_payload( WC_Order $order, $full = false ) {
		$items = array();
		foreach ( $order->get_items() as $item ) {
			/** @var WC_Order_Item_Product $item */
			$product = $item->get_product();
			$img_id  = $product ? (int) $product->get_image_id() : 0;
			if ( $product && ! $img_id && $product->get_parent_id() ) {
				$parent = wc_get_product( $product->get_parent_id() );
				$img_id = $parent ? (int) $parent->get_image_id() : 0;
			}
			$img     = $img_id ? wp_get_attachment_image_url( $img_id, 'woocommerce_thumbnail' ) : '';
			$meta    = array();
			foreach ( $item->get_formatted_meta_data( '_', true ) as $m ) {
				$meta[] = array( 'key' => wp_strip_all_tags( $m->display_key ), 'value' => wp_strip_all_tags( $m->display_value ) );
			}
			$items[] = array(
				'id'         => $item->get_id(),
				'product_id' => $item->get_product_id(),
				'name'       => $item->get_name(),
				'quantity'   => $item->get_quantity(),
				'total'      => self::money( $item->get_total() + $item->get_total_tax() ),
				'image'      => $img ? $img : '',
				'meta'       => $meta,
			);
		}
		$out = array(
			'id'           => $order->get_id(),
			'number'       => $order->get_order_number(),
			'status'       => $order->get_status(),
			'status_label' => wc_get_order_status_name( $order->get_status() ),
			'date'         => $order->get_date_created() ? $order->get_date_created()->date( 'c' ) : '',
			'total'        => self::money( $order->get_total() ),
			'currency'     => $order->get_currency(),
			'items_count'  => $order->get_item_count(),
			'thumb'        => isset( $items[0] ) ? $items[0]['image'] : '',
		);
		if ( ! $full ) {
			return $out;
		}
		$notes = array();
		foreach ( $order->get_customer_order_notes() as $n ) {
			$notes[] = array( 'date' => mysql2date( 'c', $n->comment_date ), 'note' => wp_strip_all_tags( $n->comment_content ) );
		}
		$out += array(
			'items'          => $items,
			'subtotal'       => self::money( $order->get_subtotal() ),
			'shipping_total' => self::money( (float) $order->get_shipping_total() + (float) $order->get_shipping_tax() ),
			'shipping_method'=> $order->get_shipping_method(),
			'discount_total' => self::money( $order->get_discount_total() ),
			'tax_total'      => self::money( $order->get_total_tax() ),
			'fees'           => array_values( array_map( function ( $f ) {
				return array( 'name' => $f->get_name(), 'total' => self::money( $f->get_total() ) );
			}, $order->get_fees() ) ),
			'payment_method' => $order->get_payment_method_title(),
			'needs_payment'  => $order->needs_payment(),
			'payment_url'    => $order->needs_payment() ? $order->get_checkout_payment_url() : '',
			'billing'        => self::address( $order, 'billing' ),
			'shipping'       => self::address( $order, 'shipping' ),
			'customer_note'  => $order->get_customer_note(),
			'notes'          => $notes,
			'can_cancel'     => $order->has_status( apply_filters( 'woocommerce_valid_order_statuses_for_cancel', array( 'pending', 'failed' ), $order ) ),
			'timeline'       => self::timeline( $order ),
		);
		return apply_filters( 'storeapp_order_payload', $out, $order );
	}

	private static function timeline( WC_Order $order ) {
		$steps  = array(
			array( 'key' => 'placed', 'label' => __( 'Order placed', 'storeapp' ) ),
			array( 'key' => 'processing', 'label' => __( 'Confirmed', 'storeapp' ) ),
			array( 'key' => 'shipped', 'label' => __( 'On the way', 'storeapp' ) ),
			array( 'key' => 'completed', 'label' => __( 'Delivered', 'storeapp' ) ),
		);
		$status = $order->get_status();
		$rank   = array( 'pending' => 0, 'on-hold' => 0, 'checkout-draft' => 0, 'processing' => 1, 'shipped' => 2, 'out-for-delivery' => 2, 'in-transit' => 2, 'completed' => 3 );
		$cur    = isset( $rank[ $status ] ) ? $rank[ $status ] : -1;
		foreach ( $steps as $i => &$s ) {
			$s['done'] = $cur >= $i;
		}
		return array(
			'steps'     => $steps,
			'cancelled' => in_array( $status, array( 'cancelled', 'refunded', 'failed' ), true ),
		);
	}

	/* ---------------- Profile ---------------- */

	public static function me() {
		return rest_ensure_response( self::user_payload( wp_get_current_user() ) );
	}

	public static function update_me( WP_REST_Request $req ) {
		$user = wp_get_current_user();
		$c    = new WC_Customer( $user->ID );
		$args = array( 'ID' => $user->ID );

		if ( null !== $req->get_param( 'name' ) ) {
			$name                 = sanitize_text_field( $req->get_param( 'name' ) );
			$parts                = explode( ' ', $name, 2 );
			$args['display_name'] = $name;
			$args['first_name']   = $parts[0];
			$args['last_name']    = isset( $parts[1] ) ? $parts[1] : '';
		}
		if ( null !== $req->get_param( 'email' ) ) {
			$email = sanitize_email( $req->get_param( 'email' ) );
			if ( $email && email_exists( $email ) && email_exists( $email ) !== $user->ID ) {
				return new WP_Error( 'storeapp_email_taken', __( 'This email is used by another account.', 'storeapp' ), array( 'status' => 409 ) );
			}
			$args['user_email'] = $email;
		}
		$r = wp_update_user( $args );
		if ( is_wp_error( $r ) ) {
			return new WP_Error( 'storeapp_update', $r->get_error_message(), array( 'status' => 400 ) );
		}
		if ( null !== $req->get_param( 'phone' ) ) {
			$c->set_billing_phone( StoreApp_Auth::normalize_phone( $req->get_param( 'phone' ) ) );
		}
		foreach ( array( 'billing', 'shipping' ) as $type ) {
			$addr = $req->get_param( $type );
			if ( is_array( $addr ) ) {
				foreach ( $addr as $k => $v ) {
					$setter = "set_{$type}_" . sanitize_key( $k );
					if ( is_callable( array( $c, $setter ) ) ) {
						$c->$setter( sanitize_text_field( $v ) );
					}
				}
			}
		}
		$c->save();
		return rest_ensure_response( self::user_payload( get_user_by( 'id', $user->ID ) ) );
	}

	public static function password( WP_REST_Request $req ) {
		$user = wp_get_current_user();
		$cur  = (string) $req->get_param( 'current' );
		$new  = (string) $req->get_param( 'password' );
		if ( ! wp_check_password( $cur, $user->user_pass, $user->ID ) ) {
			return new WP_Error( 'storeapp_bad_password', __( 'Current password is wrong.', 'storeapp' ), array( 'status' => 400 ) );
		}
		if ( strlen( $new ) < 6 ) {
			return new WP_Error( 'storeapp_password', __( 'Password must be at least 6 characters.', 'storeapp' ), array( 'status' => 400 ) );
		}
		wp_set_password( $new, $user->ID ); // Also clears sessions.
		delete_user_meta( $user->ID, StoreApp_Auth::META );
		return rest_ensure_response( array(
			'token' => StoreApp_Auth::issue_token( $user->ID, 'password-change' ),
		) );
	}

	/** In-app account deletion (Apple App Store guideline 5.1.1(v)). */
	public static function delete_me( WP_REST_Request $req ) {
		$user = wp_get_current_user();
		if ( array_intersect( array( 'administrator', 'shop_manager', 'editor' ), (array) $user->roles ) ) {
			return new WP_Error( 'storeapp_staff', __( 'Staff accounts cannot be deleted from the app.', 'storeapp' ), array( 'status' => 403 ) );
		}
		if ( ! wp_check_password( (string) $req->get_param( 'password' ), $user->user_pass, $user->ID ) ) {
			return new WP_Error( 'storeapp_bad_password', __( 'Password is wrong.', 'storeapp' ), array( 'status' => 400 ) );
		}
		require_once ABSPATH . 'wp-admin/includes/user.php';
		StoreApp_Push::forget_user( $user->ID );
		wp_delete_user( $user->ID );
		return rest_ensure_response( array( 'deleted' => true ) );
	}

	/* ---------------- Orders ---------------- */

	public static function orders( WP_REST_Request $req ) {
		$page   = max( 1, (int) $req->get_param( 'page' ) );
		$result = wc_get_orders( array(
			'customer_id' => get_current_user_id(),
			'limit'       => 15,
			'paged'       => $page,
			'paginate'    => true,
			'orderby'     => 'date',
			'order'       => 'DESC',
			'status'      => array_diff( array_keys( wc_get_order_statuses() ), array( 'wc-checkout-draft' ) ),
		) );
		$orders = array_map( function ( $o ) {
			return self::order_payload( $o );
		}, $result->orders );
		return rest_ensure_response( array(
			'orders'      => $orders,
			'page'        => $page,
			'total_pages' => (int) $result->max_num_pages,
		) );
	}

	/**
	 * A customer may read their own order; a guest needs the order key (kept by the app after checkout).
	 */
	private static function can_view( WC_Order $order, $key ) {
		if ( is_user_logged_in() && (int) $order->get_customer_id() === get_current_user_id() ) {
			return true;
		}
		return $key && hash_equals( $order->get_order_key(), (string) $key );
	}

	public static function order( WP_REST_Request $req ) {
		$order = wc_get_order( (int) $req['id'] );
		if ( ! $order || ! self::can_view( $order, $req->get_param( 'key' ) ) ) {
			return new WP_Error( 'storeapp_not_found', __( 'Order not found.', 'storeapp' ), array( 'status' => 404 ) );
		}
		return rest_ensure_response( self::order_payload( $order, true ) );
	}

	public static function cancel( WP_REST_Request $req ) {
		$order = wc_get_order( (int) $req['id'] );
		if ( ! $order || (int) $order->get_customer_id() !== get_current_user_id() ) {
			return new WP_Error( 'storeapp_not_found', __( 'Order not found.', 'storeapp' ), array( 'status' => 404 ) );
		}
		$valid = apply_filters( 'woocommerce_valid_order_statuses_for_cancel', array( 'pending', 'failed' ), $order );
		if ( ! $order->has_status( $valid ) ) {
			return new WP_Error( 'storeapp_cannot_cancel', __( 'This order can no longer be cancelled. Please contact the store.', 'storeapp' ), array( 'status' => 400 ) );
		}
		$order->update_status( 'cancelled', __( 'Cancelled by customer from the app.', 'storeapp' ) );
		do_action( 'woocommerce_cancelled_order', $order->get_id() );
		return rest_ensure_response( self::order_payload( $order, true ) );
	}

	/** Guest tracking: order number + phone (or email). */
	public static function track( WP_REST_Request $req ) {
		$rl = StoreApp_Auth::rate_limit( 'track', 20, 600 );
		if ( is_wp_error( $rl ) ) {
			return $rl;
		}
		$id      = (int) preg_replace( '/[^0-9]/', '', (string) $req->get_param( 'order' ) );
		$contact = trim( (string) $req->get_param( 'contact' ) );
		$order   = $id ? wc_get_order( $id ) : null;
		if ( ! $order ) {
			// Custom order numbers (sequential order plugins).
			$found = wc_get_orders( array( 'limit' => 1, 'meta_key' => '_order_number', 'meta_value' => (string) $req->get_param( 'order' ), 'return' => 'objects' ) ); // phpcs:ignore WordPress.DB.SlowDBQuery
			$order = $found ? $found[0] : null;
		}
		$ok = false;
		if ( $order && $contact ) {
			if ( is_email( $contact ) ) {
				$ok = 0 === strcasecmp( $order->get_billing_email(), $contact );
			} else {
				$a  = StoreApp_Auth::normalize_phone( $order->get_billing_phone() );
				$b  = StoreApp_Auth::normalize_phone( $contact );
				$ok = $a && $b && substr( $a, -10 ) === substr( $b, -10 );
			}
		}
		if ( ! $ok ) {
			return new WP_Error( 'storeapp_not_found', __( 'No order found with these details.', 'storeapp' ), array( 'status' => 404 ) );
		}
		$data        = self::order_payload( $order, true );
		$data['key'] = $order->get_order_key();
		return rest_ensure_response( $data );
	}
}
