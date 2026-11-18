<?php
/**
 * Push notifications through Expo Push Service (works for both iOS and Android builds).
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class StoreApp_Push {

	const EXPO_URL = 'https://exp.host/--/api/v2/push/send';

	public static function table() {
		global $wpdb;
		return $wpdb->prefix . 'storeapp_devices';
	}

	public static function install() {
		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		$charset = $wpdb->get_charset_collate();
		$table   = self::table();
		dbDelta( "CREATE TABLE {$table} (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			token varchar(191) NOT NULL,
			user_id bigint(20) unsigned NOT NULL DEFAULT 0,
			platform varchar(20) NOT NULL DEFAULT '',
			created datetime NOT NULL,
			last_seen datetime NOT NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY token (token),
			KEY user_id (user_id)
		) {$charset};" );
		update_option( 'storeapp_db_version', STOREAPP_VERSION, false );
		if ( ! get_option( StoreApp_Settings::OPTION ) ) {
			StoreApp_Settings::update( array() );
		}
	}

	public static function init() {
		if ( get_option( 'storeapp_db_version' ) !== STOREAPP_VERSION ) {
			self::install();
		}
		add_action( 'rest_api_init', array( __CLASS__, 'routes' ) );
		add_action( 'woocommerce_order_status_changed', array( __CLASS__, 'order_status_changed' ), 20, 4 );
		add_action( 'storeapp_send_batch', array( __CLASS__, 'send_batch' ), 10, 3 );
	}

	public static function routes() {
		register_rest_route( STOREAPP_NS, '/push/register', array(
			'methods'             => 'POST',
			'callback'            => array( __CLASS__, 'rest_register' ),
			'permission_callback' => '__return_true',
		) );
	}

	public static function valid_token( $t ) {
		return (bool) preg_match( '/^(Exponent|Expo)PushToken\[[A-Za-z0-9_\-]+\]$/', (string) $t );
	}

	public static function rest_register( WP_REST_Request $req ) {
		$token = (string) $req->get_param( 'token' );
		if ( ! self::valid_token( $token ) ) {
			return new WP_Error( 'storeapp_push_token', 'Invalid push token.', array( 'status' => 400 ) );
		}
		self::register_device( $token, get_current_user_id(), (string) $req->get_param( 'platform' ) );
		return rest_ensure_response( array( 'ok' => true ) );
	}

	public static function register_device( $token, $user_id = 0, $platform = '' ) {
		global $wpdb;
		if ( ! self::valid_token( $token ) ) {
			return;
		}
		$now = current_time( 'mysql', true );
		$wpdb->query( $wpdb->prepare( // phpcs:ignore WordPress.DB.DirectDatabaseQuery
			'INSERT INTO ' . self::table() . ' (token, user_id, platform, created, last_seen) VALUES (%s, %d, %s, %s, %s)
			ON DUPLICATE KEY UPDATE user_id = IF(VALUES(user_id) > 0, VALUES(user_id), user_id), platform = VALUES(platform), last_seen = VALUES(last_seen)',
			$token,
			(int) $user_id,
			sanitize_key( $platform ),
			$now,
			$now
		) );
	}

	public static function detach_user( $token ) {
		global $wpdb;
		$wpdb->update( self::table(), array( 'user_id' => 0 ), array( 'token' => $token ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery
	}

	public static function forget_user( $user_id ) {
		global $wpdb;
		$wpdb->delete( self::table(), array( 'user_id' => (int) $user_id ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery
	}

	public static function tokens_for_user( $user_id ) {
		global $wpdb;
		if ( ! $user_id ) {
			return array();
		}
		return $wpdb->get_col( $wpdb->prepare( 'SELECT token FROM ' . self::table() . ' WHERE user_id = %d', $user_id ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery
	}

	public static function count_devices() {
		global $wpdb;
		return (int) $wpdb->get_var( 'SELECT COUNT(*) FROM ' . self::table() ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery
	}

	/**
	 * Send one message to many tokens (Expo accepts 100 per request).
	 */
	public static function send( array $tokens, $title, $body, array $data = array() ) {
		$tokens = array_values( array_unique( array_filter( $tokens, array( __CLASS__, 'valid_token' ) ) ) );
		$sent   = 0;
		foreach ( array_chunk( $tokens, 100 ) as $chunk ) {
			$messages = array();
			foreach ( $chunk as $t ) {
				$messages[] = array(
					'to'        => $t,
					'title'     => $title,
					'body'      => $body,
					'data'      => (object) $data,
					'sound'     => 'default',
					'channelId' => 'default',
					'priority'  => 'high',
				);
			}
			$res = wp_remote_post( self::EXPO_URL, array(
				'timeout' => 15,
				'headers' => array( 'Content-Type' => 'application/json', 'Accept' => 'application/json' ),
				'body'    => wp_json_encode( $messages ),
			) );
			if ( is_wp_error( $res ) ) {
				continue;
			}
			$json = json_decode( wp_remote_retrieve_body( $res ), true );
			foreach ( (array) ( isset( $json['data'] ) ? $json['data'] : array() ) as $i => $ticket ) {
				if ( isset( $ticket['status'] ) && 'ok' === $ticket['status'] ) {
					$sent++;
				} elseif ( isset( $ticket['details']['error'] ) && 'DeviceNotRegistered' === $ticket['details']['error'] && isset( $chunk[ $i ] ) ) {
					global $wpdb;
					$wpdb->delete( self::table(), array( 'token' => $chunk[ $i ] ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery
				}
			}
		}
		return $sent;
	}

	public static function order_status_changed( $order_id, $from, $to, $order ) {
		if ( ! StoreApp_Settings::on( 'push_order_status' ) || ! $order instanceof WC_Order ) {
			return;
		}
		if ( in_array( $to, array( 'checkout-draft', 'pending' ), true ) ) {
			return;
		}
		$tokens = self::tokens_for_user( $order->get_customer_id() );
		$t      = $order->get_meta( '_storeapp_push_token' );
		if ( $t ) {
			$tokens[] = $t;
		}
		if ( ! $tokens ) {
			return;
		}
		$messages = array(
			'processing' => __( 'Your order #%s is confirmed. We are preparing it.', 'storeapp' ),
			'on-hold'    => __( 'Your order #%s is on hold. We will contact you soon.', 'storeapp' ),
			'completed'  => __( 'Your order #%s has been delivered. Thank you!', 'storeapp' ),
			'cancelled'  => __( 'Your order #%s was cancelled.', 'storeapp' ),
			'refunded'   => __( 'Your order #%s was refunded.', 'storeapp' ),
			'failed'     => __( 'Payment for order #%s failed. Please try again.', 'storeapp' ),
		);
		$body  = isset( $messages[ $to ] ) ? $messages[ $to ] : __( 'Your order #%s is now: ', 'storeapp' ) . wc_get_order_status_name( $to );
		$title = html_entity_decode( get_bloginfo( 'name' ), ENT_QUOTES );
		$body  = apply_filters( 'storeapp_order_push_body', sprintf( $body, $order->get_order_number() ), $order, $to );
		self::send( $tokens, $title, $body, array( 'type' => 'order', 'id' => $order->get_id(), 'key' => $order->get_order_key() ) );
	}

	/**
	 * Broadcast to all devices, in background batches of 500.
	 */
	public static function broadcast( $title, $body, $link ) {
		global $wpdb;
		$total = self::count_devices();
		for ( $offset = 0; $offset < $total; $offset += 500 ) {
			wp_schedule_single_event( time() + (int) ( $offset / 500 ) * 5, 'storeapp_send_batch', array( $offset, array( 'title' => $title, 'body' => $body ), $link ) );
		}
		spawn_cron();
		return $total;
	}

	public static function send_batch( $offset, $msg, $link ) {
		global $wpdb;
		$tokens = $wpdb->get_col( $wpdb->prepare( 'SELECT token FROM ' . self::table() . ' ORDER BY id LIMIT 500 OFFSET %d', (int) $offset ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery
		self::send( $tokens, $msg['title'], $msg['body'], is_array( $link ) ? $link : array() );
	}
}
