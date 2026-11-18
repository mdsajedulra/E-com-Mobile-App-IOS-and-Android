<?php
/**
 * Settings storage (one option array) with defaults.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class StoreApp_Settings {

	const OPTION = 'storeapp_settings';

	public static function defaults() {
		return array(
			// Branding. Empty = auto-detect from the site.
			'app_name'          => '',
			'logo_id'           => 0,
			'primary'           => '',
			'secondary'         => '',
			'background'        => '',
			'text'              => '',
			'heading_font'      => '',
			'body_font'         => '',
			'radius'            => 14,
			'dark_mode'         => 'auto', // auto | light | dark.
			// Home.
			'banners'           => array(), // [{image_id, link_type, link_value}].
			'notice'            => '',
			'sections'          => array(), // [{type, title, source, category, limit}].
			// Features.
			'registration'      => 'yes',
			'wishlist'          => 'yes',
			'reviews'           => 'yes',
			'coupons'           => 'yes',
			'language'          => 'en', // en | bn: app UI language.
			// Contact.
			'phone'             => '',
			'whatsapp'          => '',
			'email'             => '',
			'facebook'          => '',
			// Compatibility.
			'classic_bridge'    => 'yes', // Run classic checkout validation hooks for app orders.
			'email_optional'    => 'auto', // auto | yes | no.
			// Push.
			'push_order_status' => 'yes',
		);
	}

	public static function all() {
		$saved = get_option( self::OPTION, array() );
		return wp_parse_args( is_array( $saved ) ? $saved : array(), self::defaults() );
	}

	public static function get( $key ) {
		$all = self::all();
		return isset( $all[ $key ] ) ? $all[ $key ] : null;
	}

	public static function update( array $values ) {
		$all = array_merge( self::all(), $values );
		update_option( self::OPTION, $all, false );
		update_option( 'storeapp_config_version', time(), false );
	}

	public static function on( $key ) {
		return 'yes' === self::get( $key );
	}
}
