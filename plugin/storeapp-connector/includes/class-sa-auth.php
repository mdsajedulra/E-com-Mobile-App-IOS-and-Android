<?php
/**
 * Customer authentication for the app.
 *
 * Tokens look like "{user_id}.{random}". Only a SHA-256 hash is stored in user meta.
 * The app sends it in the X-StoreApp-Token header (many hosts strip Authorization).
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class StoreApp_Auth {

	const META       = '_storeapp_tokens';
	const MAX_TOKENS = 10;
	const TTL        = 180 * DAY_IN_SECONDS;

	public static function init() {
		add_filter( 'determine_current_user', array( __CLASS__, 'determine_user' ), 25 );
		add_action( 'rest_api_init', array( __CLASS__, 'routes' ) );
	}

	/* ---------------- Token handling ---------------- */

	private static function header_token() {
		if ( ! empty( $_SERVER['HTTP_X_STOREAPP_TOKEN'] ) ) {
			return sanitize_text_field( wp_unslash( $_SERVER['HTTP_X_STOREAPP_TOKEN'] ) );
		}
		$auth = '';
		if ( ! empty( $_SERVER['HTTP_AUTHORIZATION'] ) ) {
			$auth = wp_unslash( $_SERVER['HTTP_AUTHORIZATION'] );
		} elseif ( ! empty( $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ) ) {
			$auth = wp_unslash( $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] );
		}
		if ( $auth && preg_match( '/^Bearer\s+(\d+\.[A-Za-z0-9]+)$/', trim( $auth ), $m ) ) {
			return $m[1];
		}
		return '';
	}

	public static function determine_user( $user_id ) {
		if ( $user_id ) {
			return $user_id;
		}
		$token = self::header_token();
		if ( ! $token ) {
			return $user_id;
		}
		$found = self::validate_token( $token );
		return $found ? $found : $user_id;
	}

	public static function validate_token( $token ) {
		if ( ! preg_match( '/^(\d+)\.([A-Za-z0-9]{40,})$/', $token, $m ) ) {
			return 0;
		}
		$uid    = (int) $m[1];
		$hash   = hash( 'sha256', $token );
		$tokens = get_user_meta( $uid, self::META, true );
		if ( ! is_array( $tokens ) ) {
			return 0;
		}
		foreach ( $tokens as $t ) {
			if ( isset( $t['h'] ) && hash_equals( $t['h'], $hash ) && ( $t['e'] > time() ) ) {
				return $uid;
			}
		}
		return 0;
	}

	public static function issue_token( $user_id, $device = '' ) {
		$token  = $user_id . '.' . wp_generate_password( 48, false, false );
		$tokens = get_user_meta( $user_id, self::META, true );
		$tokens = is_array( $tokens ) ? $tokens : array();
		$tokens = array_values( array_filter( $tokens, function ( $t ) {
			return isset( $t['e'] ) && $t['e'] > time();
		} ) );
		$tokens[] = array(
			'h' => hash( 'sha256', $token ),
			'e' => time() + self::TTL,
			'd' => substr( sanitize_text_field( $device ), 0, 80 ),
			'c' => time(),
		);
		if ( count( $tokens ) > self::MAX_TOKENS ) {
			$tokens = array_slice( $tokens, -self::MAX_TOKENS );
		}
		update_user_meta( $user_id, self::META, $tokens );
		return $token;
	}

	public static function revoke_token( $token ) {
		$uid = self::validate_token( $token );
		if ( ! $uid ) {
			return;
		}
		$hash   = hash( 'sha256', $token );
		$tokens = get_user_meta( $uid, self::META, true );
		$tokens = array_values( array_filter( (array) $tokens, function ( $t ) use ( $hash ) {
			return ! hash_equals( $t['h'], $hash );
		} ) );
		update_user_meta( $uid, self::META, $tokens );
	}

	/* ---------------- Routes ---------------- */

	public static function routes() {
		register_rest_route( STOREAPP_NS, '/auth/login', array(
			'methods'             => 'POST',
			'callback'            => array( __CLASS__, 'login' ),
			'permission_callback' => '__return_true',
		) );
		register_rest_route( STOREAPP_NS, '/auth/register', array(
			'methods'             => 'POST',
			'callback'            => array( __CLASS__, 'register' ),
			'permission_callback' => '__return_true',
		) );
		register_rest_route( STOREAPP_NS, '/auth/forgot', array(
			'methods'             => 'POST',
			'callback'            => array( __CLASS__, 'forgot' ),
			'permission_callback' => '__return_true',
		) );
		register_rest_route( STOREAPP_NS, '/auth/logout', array(
			'methods'             => 'POST',
			'callback'            => array( __CLASS__, 'logout' ),
			'permission_callback' => '__return_true',
		) );
	}

	public static function rate_limit( $key, $max = 10, $window = 600 ) {
		$ip  = isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) : '0';
		$tk  = 'storeapp_rl_' . md5( $key . $ip );
		$hit = (int) get_transient( $tk );
		if ( $hit >= $max ) {
			return new WP_Error( 'storeapp_rate_limited', __( 'Too many attempts. Please try again in a few minutes.', 'storeapp' ), array( 'status' => 429 ) );
		}
		set_transient( $tk, $hit + 1, $window );
		return true;
	}

	public static function normalize_phone( $p ) {
		$p = preg_replace( '/[^0-9+]/', '', (string) $p );
		$p = ltrim( $p, '+' );
		if ( 0 === strpos( $p, '880' ) ) {
			$p = '0' . substr( $p, 3 );
		}
		return $p;
	}

	/**
	 * Find a user by username, email or billing phone.
	 */
	public static function find_user( $login ) {
		$login = trim( (string) $login );
		if ( '' === $login ) {
			return null;
		}
		if ( is_email( $login ) ) {
			$u = get_user_by( 'email', $login );
			if ( $u ) {
				return $u;
			}
		}
		$u = get_user_by( 'login', $login );
		if ( $u ) {
			return $u;
		}
		$phone = self::normalize_phone( $login );
		if ( strlen( $phone ) >= 8 ) {
			$q = get_users( array(
				'meta_key'   => 'billing_phone', // phpcs:ignore WordPress.DB.SlowDBQuery
				'meta_value' => $phone, // phpcs:ignore WordPress.DB.SlowDBQuery
				'number'     => 1,
				'fields'     => 'all',
			) );
			if ( $q ) {
				return $q[0];
			}
			$u = get_user_by( 'login', $phone );
			if ( $u ) {
				return $u;
			}
		}
		return null;
	}

	private static function session_payload( WP_User $user, $device ) {
		return array(
			'token' => self::issue_token( $user->ID, $device ),
			'user'  => StoreApp_Account::user_payload( $user ),
		);
	}

	public static function login( WP_REST_Request $req ) {
		$rl = self::rate_limit( 'login', 10 );
		if ( is_wp_error( $rl ) ) {
			return $rl;
		}
		$login = (string) $req->get_param( 'login' );
		$pass  = (string) $req->get_param( 'password' );
		$user  = self::find_user( $login );
		if ( ! $user || ! wp_check_password( $pass, $user->user_pass, $user->ID ) ) {
			return new WP_Error( 'storeapp_bad_login', __( 'Wrong phone/email or password.', 'storeapp' ), array( 'status' => 401 ) );
		}
		/** Allow other plugins (2FA, bans) to block app logins. */
		$check = apply_filters( 'wp_authenticate_user', $user, $pass );
		if ( is_wp_error( $check ) ) {
			return new WP_Error( 'storeapp_blocked', wp_strip_all_tags( $check->get_error_message() ), array( 'status' => 403 ) );
		}
		do_action( 'wp_login', $user->user_login, $user );
		return rest_ensure_response( self::session_payload( $user, (string) $req->get_param( 'device' ) ) );
	}

	public static function register( WP_REST_Request $req ) {
		if ( ! StoreApp_Settings::on( 'registration' ) ) {
			return new WP_Error( 'storeapp_registration_off', __( 'Registration is turned off for this store.', 'storeapp' ), array( 'status' => 403 ) );
		}
		$rl = self::rate_limit( 'register', 5, 3600 );
		if ( is_wp_error( $rl ) ) {
			return $rl;
		}
		$name  = sanitize_text_field( (string) $req->get_param( 'name' ) );
		$phone = self::normalize_phone( $req->get_param( 'phone' ) );
		$email = sanitize_email( (string) $req->get_param( 'email' ) );
		$pass  = (string) $req->get_param( 'password' );

		if ( '' === $name ) {
			return new WP_Error( 'storeapp_name', __( 'Please enter your name.', 'storeapp' ), array( 'status' => 400 ) );
		}
		if ( '' === $phone && '' === $email ) {
			return new WP_Error( 'storeapp_contact', __( 'Please enter a phone number or email.', 'storeapp' ), array( 'status' => 400 ) );
		}
		if ( $phone && ! preg_match( '/^[0-9]{8,15}$/', $phone ) ) {
			return new WP_Error( 'storeapp_phone', __( 'Please enter a valid phone number.', 'storeapp' ), array( 'status' => 400 ) );
		}
		if ( strlen( $pass ) < 6 ) {
			return new WP_Error( 'storeapp_password', __( 'Password must be at least 6 characters.', 'storeapp' ), array( 'status' => 400 ) );
		}
		if ( $email && email_exists( $email ) ) {
			return new WP_Error( 'storeapp_exists', __( 'An account with this email already exists. Please log in.', 'storeapp' ), array( 'status' => 409 ) );
		}
		if ( $phone && self::find_user( $phone ) ) {
			return new WP_Error( 'storeapp_exists', __( 'An account with this phone number already exists. Please log in.', 'storeapp' ), array( 'status' => 409 ) );
		}

		$username = $phone ? $phone : sanitize_user( current( explode( '@', $email ) ), true );
		$base     = $username;
		$i        = 1;
		while ( username_exists( $username ) ) {
			$username = $base . $i++;
		}

		$parts   = explode( ' ', $name, 2 );
		$user_id = wp_insert_user( array(
			'user_login'   => $username,
			'user_pass'    => $pass,
			'user_email'   => $email,
			'first_name'   => $parts[0],
			'last_name'    => isset( $parts[1] ) ? $parts[1] : '',
			'display_name' => $name,
			'role'         => 'customer',
		) );
		if ( is_wp_error( $user_id ) ) {
			return new WP_Error( 'storeapp_register_failed', $user_id->get_error_message(), array( 'status' => 400 ) );
		}
		update_user_meta( $user_id, 'billing_first_name', $parts[0] );
		update_user_meta( $user_id, 'billing_last_name', isset( $parts[1] ) ? $parts[1] : '' );
		if ( $phone ) {
			update_user_meta( $user_id, 'billing_phone', $phone );
		}
		if ( $email ) {
			update_user_meta( $user_id, 'billing_email', $email );
		}
		update_user_meta( $user_id, '_storeapp_registered', time() );
		do_action( 'woocommerce_created_customer', $user_id, array( 'user_login' => $username, 'user_email' => $email ), false );

		return rest_ensure_response( self::session_payload( get_user_by( 'id', $user_id ), (string) $req->get_param( 'device' ) ) );
	}

	public static function forgot( WP_REST_Request $req ) {
		$rl = self::rate_limit( 'forgot', 5, 3600 );
		if ( is_wp_error( $rl ) ) {
			return $rl;
		}
		$user = self::find_user( (string) $req->get_param( 'login' ) );
		// Same answer whether or not the account exists.
		$msg = __( 'If an account with an email exists, a reset link has been sent.', 'storeapp' );
		if ( $user && $user->user_email ) {
			retrieve_password( $user->user_login );
		} elseif ( $user && ! $user->user_email ) {
			$msg = __( 'This account has no email. Please contact the store to reset your password.', 'storeapp' );
		}
		return rest_ensure_response( array( 'message' => $msg ) );
	}

	public static function logout( WP_REST_Request $req ) {
		$token = self::header_token();
		if ( $token ) {
			self::revoke_token( $token );
		}
		$push = sanitize_text_field( (string) $req->get_param( 'push_token' ) );
		if ( $push ) {
			StoreApp_Push::detach_user( $push );
		}
		return rest_ensure_response( array( 'ok' => true ) );
	}
}
