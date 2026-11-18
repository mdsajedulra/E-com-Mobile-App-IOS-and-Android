<?php
/**
 * Checkout bridge between the app (WooCommerce Store API) and the site's classic checkout rules.
 *
 * Most stores customise the classic checkout (phone validation, duplicate-order guards,
 * address plugins...). The Store API does not run those hooks, so app orders would skip them.
 * For requests coming from the app we run the classic validation hooks and turn their errors
 * into Store API errors, so the app enforces exactly the same rules as the website.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class StoreApp_Checkout {

	const PLACEHOLDER_DOMAIN = 'no-email.invalid';

	private static $data = array();

	public static function init() {
		add_action( 'woocommerce_blocks_loaded', array( __CLASS__, 'register_extension' ) );
		add_action( 'woocommerce_store_api_checkout_update_order_from_request', array( __CLASS__, 'from_request' ), 5, 2 );
		add_action( 'woocommerce_checkout_validate_order_before_payment', array( __CLASS__, 'validate' ), 20, 2 );
		add_action( 'woocommerce_store_api_checkout_order_processed', array( __CLASS__, 'processed' ), 5 );
		add_action( 'woocommerce_store_api_checkout_update_customer_from_request', array( __CLASS__, 'customer' ), 20, 2 );
		add_filter( 'woocommerce_email_recipient_customer_processing_order', array( __CLASS__, 'no_placeholder_mail' ), 99, 2 );
		add_filter( 'woocommerce_email_recipient_customer_on_hold_order', array( __CLASS__, 'no_placeholder_mail' ), 99, 2 );
		add_filter( 'woocommerce_email_recipient_customer_completed_order', array( __CLASS__, 'no_placeholder_mail' ), 99, 2 );
		add_filter( 'woocommerce_get_country_locale', array( __CLASS__, 'align_locale' ), 999 );
		add_filter( 'woocommerce_get_country_locale_default', array( __CLASS__, 'align_default' ), 999 );
	}

	public static function align_default( $fields ) {
		$out = self::align_locale( array( 'default' => $fields ) );
		return $out['default'];
	}

	/**
	 * The Store API checks required address fields from the country locale, which knows nothing
	 * about fields the site removed from its checkout (e.g. last name). For app requests, make the
	 * locale match the website's real checkout fields.
	 */
	public static function align_locale( $locales ) {
		static $busy = false, $billing = null;
		if ( $busy || ! storeapp_is_app_request() || ! is_array( $locales ) ) {
			return $locales;
		}
		if ( null === $billing ) {
			$busy = true;
			$temp = false;
			try {
				if ( ! WC()->customer ) {
					WC()->customer = new WC_Customer( get_current_user_id(), true );
					$temp          = true;
				}
				$billing = WC()->checkout() ? WC()->checkout()->get_checkout_fields( 'billing' ) : array();
			} catch ( \Throwable $e ) {
				$billing = array();
			}
			if ( $temp ) {
				WC()->customer = null;
			}
			$busy = false;
		}
		if ( ! $billing ) {
			return $locales;
		}
		foreach ( $locales as $cc => $loc ) {
			foreach ( array( 'first_name', 'last_name', 'company', 'address_1', 'address_2', 'city', 'state', 'postcode' ) as $k ) {
				if ( ! isset( $billing[ 'billing_' . $k ] ) ) {
					$locales[ $cc ][ $k ]['required'] = false;
					$locales[ $cc ][ $k ]['hidden']   = true;
				} else {
					$locales[ $cc ][ $k ]['required'] = ! empty( $billing[ 'billing_' . $k ]['required'] );
				}
			}
		}
		return $locales;
	}

	public static function register_extension() {
		if ( ! function_exists( 'woocommerce_store_api_register_endpoint_data' ) ) {
			return;
		}
		woocommerce_store_api_register_endpoint_data( array(
			'endpoint'        => \Automattic\WooCommerce\StoreApi\Schemas\V1\CheckoutSchema::IDENTIFIER,
			'namespace'       => 'storeapp',
			'schema_callback' => function () {
				return array(
					'extra'      => array(
						'description' => 'Extra checkout fields that are not part of the standard address.',
						'type'        => array( 'object', 'null' ),
						'context'     => array( 'view', 'edit' ),
					),
					'push_token' => array(
						'description' => 'Expo push token of the device placing the order.',
						'type'        => array( 'string', 'null' ),
						'context'     => array( 'view', 'edit' ),
					),
					'platform'   => array(
						'type'    => array( 'string', 'null' ),
						'context' => array( 'view', 'edit' ),
					),
				);
			},
			'schema_type'     => ARRAY_A,
		) );
	}

	private static function ext( WP_REST_Request $request ) {
		$ext = $request->get_param( 'extensions' );
		return ( is_array( $ext ) && isset( $ext['storeapp'] ) && is_array( $ext['storeapp'] ) ) ? $ext['storeapp'] : array();
	}

	public static function is_placeholder( $email ) {
		return $email && substr( $email, -strlen( self::PLACEHOLDER_DOMAIN ) ) === self::PLACEHOLDER_DOMAIN;
	}

	/**
	 * Runs while the Store API copies the request into the order.
	 */
	public static function from_request( WC_Order $order, WP_REST_Request $request ) {
		if ( ! storeapp_is_app_request() ) {
			return;
		}
		$ext = self::ext( $request );

		// Extra (non-standard) billing fields defined by the site.
		$extra = isset( $ext['extra'] ) && is_array( $ext['extra'] ) ? $ext['extra'] : array();
		foreach ( $extra as $k => $v ) {
			$k = sanitize_key( $k );
			if ( $k ) {
				$order->update_meta_data( '_billing_' . $k, sanitize_text_field( is_scalar( $v ) ? $v : '' ) );
			}
		}

		// Many local stores do not ask for email; the Store API requires one.
		if ( ! $order->get_billing_email() && ! StoreApp_Config::email_required() ) {
			$phone = preg_replace( '/[^0-9]/', '', $order->get_billing_phone() );
			$order->set_billing_email( ( $phone ? $phone : wp_generate_password( 10, false ) ) . '@' . self::PLACEHOLDER_DOMAIN );
		}

		// Normalise the phone exactly like the classic checkout does.
		$phone = apply_filters( 'woocommerce_process_checkout_field_billing_phone', $order->get_billing_phone() );
		$order->set_billing_phone( wc_clean( $phone ) );

		$order->update_meta_data( '_storeapp_order', 1 );
		if ( ! empty( $ext['platform'] ) ) {
			$order->update_meta_data( '_storeapp_platform', sanitize_key( $ext['platform'] ) );
		}
		if ( ! empty( $ext['push_token'] ) ) {
			$order->update_meta_data( '_storeapp_push_token', sanitize_text_field( $ext['push_token'] ) );
		}

		self::$data = self::posted_data( $order, $request, $extra );
	}

	/**
	 * Same structure as WC_Checkout::get_posted_data().
	 */
	private static function posted_data( WC_Order $order, WP_REST_Request $request, array $extra ) {
		$email = $order->get_billing_email();
		$data  = array(
			'terms'                              => 1,
			'createaccount'                      => 0,
			'payment_method'                     => (string) $request->get_param( 'payment_method' ),
			'shipping_method'                    => WC()->session ? (array) WC()->session->get( 'chosen_shipping_methods', array() ) : array(),
			'ship_to_different_address'          => 0,
			'woocommerce_checkout_update_totals' => false,
			'order_comments'                     => $order->get_customer_note(),
		);
		foreach ( array( 'billing', 'shipping' ) as $type ) {
			foreach ( array( 'first_name', 'last_name', 'company', 'country', 'address_1', 'address_2', 'city', 'state', 'postcode', 'phone', 'email' ) as $k ) {
				$getter = "get_{$type}_{$k}";
				if ( is_callable( array( $order, $getter ) ) ) {
					$data[ "{$type}_{$k}" ] = (string) $order->$getter();
				}
			}
		}
		if ( self::is_placeholder( $email ) ) {
			$data['billing_email'] = '';
		}
		foreach ( $extra as $k => $v ) {
			$data[ 'billing_' . sanitize_key( $k ) ] = sanitize_text_field( is_scalar( $v ) ? $v : '' );
		}
		return $data;
	}

	/**
	 * Run the website's classic checkout validation for app orders.
	 */
	public static function validate( WC_Order $order, WP_Error $errors ) {
		if ( ! storeapp_is_app_request() || ! StoreApp_Settings::on( 'classic_bridge' ) || ! self::$data ) {
			return;
		}
		$data = self::$data;

		// Legacy code reads $_POST directly.
		$backup = $_POST; // phpcs:ignore WordPress.Security.NonceVerification
		$_POST  = array_merge( $_POST, $data ); // phpcs:ignore WordPress.Security.NonceVerification

		$before = function_exists( 'wc_get_notices' ) ? wc_get_notices( 'error' ) : array();
		$legacy = new WP_Error();

		try {
			do_action( 'woocommerce_checkout_process' );
			do_action( 'woocommerce_after_checkout_validation', $data, $legacy );
		} catch ( \Throwable $e ) {
			$legacy->add( 'storeapp_validation', $e->getMessage() );
		}

		$after = function_exists( 'wc_get_notices' ) ? wc_get_notices( 'error' ) : array();
		if ( count( $after ) > count( $before ) ) {
			foreach ( array_slice( $after, count( $before ) ) as $n ) {
				$legacy->add( 'storeapp_notice', is_array( $n ) ? $n['notice'] : $n );
			}
			// Remove only the notices we created.
			$all = WC()->session ? WC()->session->get( 'wc_notices', array() ) : array();
			if ( isset( $all['error'] ) ) {
				$all['error'] = array_slice( $all['error'], 0, count( $before ) );
				WC()->session->set( 'wc_notices', $all );
			}
		}
		$_POST = $backup; // phpcs:ignore WordPress.Security.NonceVerification

		foreach ( $legacy->get_error_codes() as $code ) {
			foreach ( $legacy->get_error_messages( $code ) as $msg ) {
				$errors->add( 'storeapp_' . sanitize_key( $code ), html_entity_decode( wp_strip_all_tags( $msg ), ENT_QUOTES ) );
			}
		}
	}

	public static function processed( WC_Order $order ) {
		if ( ! storeapp_is_app_request() ) {
			return;
		}
		$data = self::$data ? self::$data : array();

		if ( self::is_placeholder( $order->get_billing_email() ) ) {
			$order->set_billing_email( '' );
			$order->save();
		}
		$order->add_order_note( __( 'Order placed from the mobile app.', 'storeapp' ) );

		$token = $order->get_meta( '_storeapp_push_token' );
		if ( $token ) {
			StoreApp_Push::register_device( $token, $order->get_customer_id(), (string) $order->get_meta( '_storeapp_platform' ) );
		}

		if ( StoreApp_Settings::on( 'classic_bridge' ) ) {
			// Duplicate-order guards, SMS plugins, CRM syncs... listen to this classic hook.
			do_action( 'woocommerce_checkout_order_processed', $order->get_id(), $data, $order );
		}
	}

	public static function customer( $customer, $request ) {
		if ( $customer && self::is_placeholder( $customer->get_billing_email() ) ) {
			$customer->set_billing_email( '' );
		}
	}

	public static function no_placeholder_mail( $recipient, $order ) {
		if ( self::is_placeholder( $recipient ) ) {
			return '';
		}
		return $recipient;
	}
}
