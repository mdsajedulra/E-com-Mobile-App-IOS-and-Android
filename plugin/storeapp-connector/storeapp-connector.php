<?php
/**
 * Plugin Name: StoreApp Connector
 * Description: Turns this WooCommerce store into a native iOS/Android app. Exposes branding, home layout, customer login, account, orders and push notifications to the StoreApp mobile app.
 * Version: 1.0.1
 * Author: Md Sajedul Islam
 * Requires at least: 6.4
 * Requires PHP: 7.4
 * WC requires at least: 8.6
 * Text Domain: storeapp
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'STOREAPP_VERSION', '1.0.1' );
define( 'STOREAPP_FILE', __FILE__ );
define( 'STOREAPP_DIR', plugin_dir_path( __FILE__ ) );
define( 'STOREAPP_URL', plugin_dir_url( __FILE__ ) );
define( 'STOREAPP_NS', 'storeapp/v1' );

require_once STOREAPP_DIR . 'includes/class-sa-settings.php';
require_once STOREAPP_DIR . 'includes/class-sa-auth.php';
require_once STOREAPP_DIR . 'includes/class-sa-branding.php';
require_once STOREAPP_DIR . 'includes/class-sa-config.php';
require_once STOREAPP_DIR . 'includes/class-sa-account.php';
require_once STOREAPP_DIR . 'includes/class-sa-checkout.php';
require_once STOREAPP_DIR . 'includes/class-sa-push.php';
require_once STOREAPP_DIR . 'includes/class-sa-admin.php';

/**
 * True when the current request comes from the StoreApp mobile app.
 */
function storeapp_is_app_request() {
	return ! empty( $_SERVER['HTTP_X_STOREAPP'] ) || ! empty( $_SERVER['HTTP_X_STOREAPP_TOKEN'] );
}

register_activation_hook( __FILE__, array( 'StoreApp_Push', 'install' ) );

add_action( 'before_woocommerce_init', function () {
	if ( class_exists( '\Automattic\WooCommerce\Utilities\FeaturesUtil' ) ) {
		\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'custom_order_tables', __FILE__, true );
	}
} );

add_action( 'plugins_loaded', function () {
	StoreApp_Auth::init();
	StoreApp_Admin::init();
	if ( ! class_exists( 'WooCommerce' ) ) {
		return;
	}
	StoreApp_Config::init();
	StoreApp_Account::init();
	StoreApp_Checkout::init();
	StoreApp_Push::init();
}, 20 );

/**
 * Personalised app responses must never be page-cached (LiteSpeed, WP Rocket, Cloudflare...).
 */
add_filter( 'rest_pre_dispatch', function ( $result, $server, $request ) {
	$route    = $request->get_route();
	$personal = storeapp_is_app_request() && ( 0 === strpos( $route, '/wc/store' ) || 0 === strpos( $route, '/' . STOREAPP_NS ) );
	if ( $personal && '/' . STOREAPP_NS . '/config' !== $route ) {
		do_action( 'litespeed_control_set_nocache', 'storeapp personalised response' );
		if ( ! defined( 'DONOTCACHEPAGE' ) ) {
			define( 'DONOTCACHEPAGE', true );
		}
		nocache_headers();
	}
	return $result;
}, 5, 3 );

add_filter( 'plugin_action_links_' . plugin_basename( __FILE__ ), function ( $links ) {
	array_unshift( $links, '<a href="' . esc_url( admin_url( 'admin.php?page=storeapp' ) ) . '">' . esc_html__( 'Settings', 'storeapp' ) . '</a>' );
	return $links;
} );
