<?php
/**
 * Admin screen: WooCommerce → StoreApp.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class StoreApp_Admin {

	public static function init() {
		add_action( 'admin_menu', array( __CLASS__, 'menu' ), 60 );
		add_action( 'admin_post_storeapp_save', array( __CLASS__, 'save' ) );
		add_action( 'admin_post_storeapp_push', array( __CLASS__, 'push' ) );
		add_action( 'admin_enqueue_scripts', array( __CLASS__, 'assets' ) );
	}

	public static function menu() {
		add_menu_page( 'StoreApp', 'StoreApp', 'manage_woocommerce', 'storeapp', array( __CLASS__, 'page' ), 'dashicons-smartphone', 56 );
	}

	public static function assets( $hook ) {
		if ( 'toplevel_page_storeapp' !== $hook ) {
			return;
		}
		wp_enqueue_media();
		wp_enqueue_style( 'wp-color-picker' );
		wp_enqueue_script( 'storeapp-admin', STOREAPP_URL . 'assets/admin.js', array( 'jquery', 'wp-color-picker' ), STOREAPP_VERSION, true );
		$cats = get_terms( array( 'taxonomy' => 'product_cat', 'hide_empty' => false ) );
		wp_localize_script( 'storeapp-admin', 'StoreAppAdmin', array(
			'categories' => array_map( function ( $t ) {
				return array( 'id' => $t->term_id, 'name' => html_entity_decode( $t->name ) );
			}, is_array( $cats ) ? $cats : array() ),
		) );
		wp_add_inline_style( 'wp-color-picker', '
			.sa-wrap{max-width:1100px}.sa-grid{display:grid;grid-template-columns:1fr 340px;gap:24px}
			.sa-card{background:#fff;border:1px solid #dcdcde;border-radius:10px;padding:18px 22px;margin-bottom:20px}
			.sa-card h2{margin-top:0}.sa-row{display:flex;gap:16px;flex-wrap:wrap}.sa-row>label{flex:1;min-width:200px}
			.sa-card label{display:block;margin:10px 0 4px;font-weight:600}.sa-muted{color:#646970;font-weight:400}
			.sa-item{border:1px solid #e0e0e0;border-radius:8px;padding:10px;margin:8px 0;display:flex;gap:10px;align-items:center;flex-wrap:wrap;background:#fafafa}
			.sa-item img{width:120px;height:60px;object-fit:cover;border-radius:6px;background:#eee}
			.sa-phone{width:300px;border-radius:32px;border:10px solid #111;overflow:hidden;position:sticky;top:40px}
			.sa-phone .bar{padding:14px 16px;display:flex;align-items:center;gap:10px}.sa-phone .bar img{height:30px}
			.sa-phone .body{padding:14px 16px;min-height:300px}.sa-phone .btn{display:block;text-align:center;padding:12px;margin-top:14px;font-weight:700}
			.sa-phone .card{padding:10px;margin-top:12px}.sa-ok{color:#008a20}.sa-bad{color:#d63638}
			.sa-sw{display:inline-block;width:18px;height:18px;border-radius:4px;vertical-align:middle;border:1px solid #ccc;margin-right:4px}
		' );
	}

	private static function checks() {
		$out   = array();
		$out[] = array( 'HTTPS', is_ssl() || 0 === strpos( home_url(), 'https://' ) );
		$out[] = array( __( 'Pretty permalinks', 'storeapp' ), (bool) get_option( 'permalink_structure' ) );
		$out[] = array( 'WooCommerce', class_exists( 'WooCommerce' ) );
		$out[] = array( __( 'Store API', 'storeapp' ), class_exists( '\Automattic\WooCommerce\StoreApi\StoreApi' ) );
		$out[] = array( __( 'Payment method enabled', 'storeapp' ), class_exists( 'WooCommerce' ) && count( WC()->payment_gateways()->get_available_payment_gateways() ) > 0 );
		return $out;
	}

	public static function page() {
		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			return;
		}
		$s     = StoreApp_Settings::all();
		$theme = class_exists( 'WooCommerce' ) ? StoreApp_Branding::theme() : null;
		$c     = $theme ? $theme['colors'] : array();
		$logo  = class_exists( 'WooCommerce' ) ? StoreApp_Branding::logo_url() : '';
		$name  = $s['app_name'] ? $s['app_name'] : html_entity_decode( get_bloginfo( 'name' ) );
		$saved = isset( $_GET['saved'] ) ? sanitize_key( $_GET['saved'] ) : ''; // phpcs:ignore WordPress.Security.NonceVerification
		?>
		<div class="wrap sa-wrap">
			<h1>StoreApp <span class="sa-muted">— <?php esc_html_e( 'your store as an iOS & Android app', 'storeapp' ); ?></span></h1>
			<?php if ( 'settings' === $saved ) : ?>
				<div class="notice notice-success is-dismissible"><p><?php esc_html_e( 'Saved. Open apps update on next launch.', 'storeapp' ); ?></p></div>
			<?php elseif ( 'push' === $saved ) : ?>
				<div class="notice notice-success is-dismissible"><p><?php esc_html_e( 'Notification queued for all devices.', 'storeapp' ); ?></p></div>
			<?php endif; ?>

			<div class="sa-grid">
			<div>
			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
				<input type="hidden" name="action" value="storeapp_save">
				<?php wp_nonce_field( 'storeapp_save' ); ?>

				<div class="sa-card">
					<h2><?php esc_html_e( 'Branding', 'storeapp' ); ?></h2>
					<p class="sa-muted"><?php esc_html_e( 'Leave a field empty to use what was detected from your theme automatically.', 'storeapp' ); ?></p>
					<label><?php esc_html_e( 'App name', 'storeapp' ); ?></label>
					<input type="text" class="regular-text" name="app_name" value="<?php echo esc_attr( $s['app_name'] ); ?>" placeholder="<?php echo esc_attr( html_entity_decode( get_bloginfo( 'name' ) ) ); ?>">

					<label><?php esc_html_e( 'App logo', 'storeapp' ); ?> <span class="sa-muted"><?php esc_html_e( '(default: site logo)', 'storeapp' ); ?></span></label>
					<input type="hidden" name="logo_id" id="sa-logo-id" value="<?php echo esc_attr( (int) $s['logo_id'] ); ?>">
					<img id="sa-logo-preview" src="<?php echo esc_url( $logo ); ?>" style="max-height:60px;display:block;margin-bottom:8px">
					<button type="button" class="button" id="sa-logo-pick"><?php esc_html_e( 'Choose logo', 'storeapp' ); ?></button>
					<button type="button" class="button-link" id="sa-logo-clear"><?php esc_html_e( 'Use site logo', 'storeapp' ); ?></button>

					<div class="sa-row">
						<?php
						foreach ( array( 'primary' => __( 'Primary color', 'storeapp' ), 'secondary' => __( 'Secondary color', 'storeapp' ), 'background' => __( 'Background', 'storeapp' ), 'text' => __( 'Text', 'storeapp' ) ) as $k => $label ) :
							?>
							<label><?php echo esc_html( $label ); ?><br>
								<span class="sa-muted"><?php esc_html_e( 'Detected:', 'storeapp' ); ?> <span class="sa-sw" style="background:<?php echo esc_attr( isset( $c[ $k ] ) ? $c[ $k ] : '' ); ?>"></span><?php echo esc_html( isset( $c[ $k ] ) ? $c[ $k ] : '' ); ?></span><br>
								<input type="text" class="sa-color" name="<?php echo esc_attr( $k ); ?>" value="<?php echo esc_attr( $s[ $k ] ); ?>">
							</label>
						<?php endforeach; ?>
					</div>
					<div class="sa-row">
						<label><?php esc_html_e( 'Heading font (Google Font name)', 'storeapp' ); ?>
							<input type="text" name="heading_font" value="<?php echo esc_attr( $s['heading_font'] ); ?>" placeholder="<?php echo esc_attr( $theme && $theme['fonts']['heading'] ? $theme['fonts']['heading']['family'] : 'System' ); ?>"></label>
						<label><?php esc_html_e( 'Body font', 'storeapp' ); ?>
							<input type="text" name="body_font" value="<?php echo esc_attr( $s['body_font'] ); ?>" placeholder="<?php echo esc_attr( $theme && $theme['fonts']['body'] ? $theme['fonts']['body']['family'] : 'System' ); ?>"></label>
						<label><?php esc_html_e( 'Corner radius', 'storeapp' ); ?>
							<input type="number" min="0" max="28" name="radius" value="<?php echo esc_attr( (int) $s['radius'] ); ?>"></label>
						<label><?php esc_html_e( 'Dark mode', 'storeapp' ); ?>
							<select name="dark_mode">
								<?php foreach ( array( 'auto' => __( 'Follow phone', 'storeapp' ), 'light' => __( 'Always light', 'storeapp' ), 'dark' => __( 'Always dark', 'storeapp' ) ) as $k => $l ) : ?>
									<option value="<?php echo esc_attr( $k ); ?>" <?php selected( $s['dark_mode'], $k ); ?>><?php echo esc_html( $l ); ?></option>
								<?php endforeach; ?>
							</select></label>
					</div>
				</div>

				<div class="sa-card">
					<h2><?php esc_html_e( 'Home screen', 'storeapp' ); ?></h2>
					<label><?php esc_html_e( 'Top notice (optional)', 'storeapp' ); ?></label>
					<input type="text" class="large-text" name="notice" value="<?php echo esc_attr( $s['notice'] ); ?>" placeholder="<?php esc_attr_e( 'Free delivery on orders over 999', 'storeapp' ); ?>">

					<label><?php esc_html_e( 'Banner slider', 'storeapp' ); ?> <span class="sa-muted"><?php esc_html_e( '(recommended size 1200×600)', 'storeapp' ); ?></span></label>
					<input type="hidden" name="banners" id="sa-banners" value="<?php echo esc_attr( wp_json_encode( self::banners_for_js( $s['banners'] ) ) ); ?>">
					<div id="sa-banner-list"></div>
					<button type="button" class="button" id="sa-banner-add"><?php esc_html_e( '+ Add banner', 'storeapp' ); ?></button>

					<label><?php esc_html_e( 'Sections (top to bottom)', 'storeapp' ); ?> <span class="sa-muted"><?php esc_html_e( 'Empty = automatic layout', 'storeapp' ); ?></span></label>
					<input type="hidden" name="sections" id="sa-sections" value="<?php echo esc_attr( wp_json_encode( array_values( (array) $s['sections'] ) ) ); ?>">
					<div id="sa-section-list"></div>
					<button type="button" class="button" id="sa-section-add"><?php esc_html_e( '+ Add section', 'storeapp' ); ?></button>
				</div>

				<div class="sa-card">
					<h2><?php esc_html_e( 'Features', 'storeapp' ); ?></h2>
					<?php
					foreach ( array(
						'registration'      => __( 'Customers can create an account in the app', 'storeapp' ),
						'wishlist'          => __( 'Wishlist', 'storeapp' ),
						'reviews'           => __( 'Product reviews', 'storeapp' ),
						'coupons'           => __( 'Coupon codes in cart', 'storeapp' ),
						'push_order_status' => __( 'Push notification when an order status changes', 'storeapp' ),
						'classic_bridge'    => __( 'Apply the website checkout rules to app orders (recommended)', 'storeapp' ),
					) as $k => $label ) :
						?>
						<p><label style="font-weight:400"><input type="checkbox" name="<?php echo esc_attr( $k ); ?>" value="yes" <?php checked( $s[ $k ], 'yes' ); ?>> <?php echo esc_html( $label ); ?></label></p>
					<?php endforeach; ?>
					<div class="sa-row">
						<label><?php esc_html_e( 'Email at checkout', 'storeapp' ); ?>
							<select name="email_optional">
								<option value="auto" <?php selected( $s['email_optional'], 'auto' ); ?>><?php esc_html_e( 'Same as website', 'storeapp' ); ?></option>
								<option value="yes" <?php selected( $s['email_optional'], 'yes' ); ?>><?php esc_html_e( 'Optional', 'storeapp' ); ?></option>
								<option value="no" <?php selected( $s['email_optional'], 'no' ); ?>><?php esc_html_e( 'Required', 'storeapp' ); ?></option>
							</select></label>
						<label><?php esc_html_e( 'App language', 'storeapp' ); ?>
							<select name="language">
								<option value="en" <?php selected( $s['language'], 'en' ); ?>>English</option>
								<option value="bn" <?php selected( $s['language'], 'bn' ); ?>>বাংলা</option>
							</select></label>
					</div>
				</div>

				<div class="sa-card">
					<h2><?php esc_html_e( 'Contact', 'storeapp' ); ?></h2>
					<div class="sa-row">
						<?php foreach ( array( 'phone' => __( 'Phone', 'storeapp' ), 'whatsapp' => 'WhatsApp', 'email' => __( 'Email', 'storeapp' ), 'facebook' => __( 'Facebook page URL', 'storeapp' ) ) as $k => $label ) : ?>
							<label><?php echo esc_html( $label ); ?><input type="text" name="<?php echo esc_attr( $k ); ?>" value="<?php echo esc_attr( $s[ $k ] ); ?>" style="width:100%"></label>
						<?php endforeach; ?>
					</div>
				</div>

				<?php submit_button( __( 'Save settings', 'storeapp' ) ); ?>
			</form>

			<div class="sa-card">
				<h2><?php esc_html_e( 'Send a notification', 'storeapp' ); ?></h2>
				<p class="sa-muted"><?php printf( esc_html__( '%d devices have the app installed with notifications on.', 'storeapp' ), (int) StoreApp_Push::count_devices() ); ?></p>
				<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
					<input type="hidden" name="action" value="storeapp_push">
					<?php wp_nonce_field( 'storeapp_push' ); ?>
					<label><?php esc_html_e( 'Title', 'storeapp' ); ?></label><input type="text" name="title" class="regular-text" required maxlength="60">
					<label><?php esc_html_e( 'Message', 'storeapp' ); ?></label><textarea name="body" class="large-text" rows="2" required maxlength="180"></textarea>
					<div class="sa-row">
						<label><?php esc_html_e( 'Open when tapped', 'storeapp' ); ?>
							<select name="link_type"><option value="none"><?php esc_html_e( 'App home', 'storeapp' ); ?></option><option value="product"><?php esc_html_e( 'Product ID', 'storeapp' ); ?></option><option value="category"><?php esc_html_e( 'Category ID', 'storeapp' ); ?></option><option value="url">URL</option></select></label>
						<label><?php esc_html_e( 'Value', 'storeapp' ); ?><input type="text" name="link_value"></label>
					</div>
					<?php submit_button( __( 'Send to all', 'storeapp' ), 'secondary' ); ?>
				</form>
			</div>
			</div>

			<div>
				<div class="sa-phone" style="background:<?php echo esc_attr( isset( $c['background'] ) ? $c['background'] : '#fff' ); ?>;color:<?php echo esc_attr( isset( $c['text'] ) ? $c['text'] : '#111' ); ?>">
					<div class="bar" style="background:<?php echo esc_attr( isset( $c['background'] ) ? $c['background'] : '#fff' ); ?>;border-bottom:1px solid <?php echo esc_attr( isset( $c['border'] ) ? $c['border'] : '#eee' ); ?>">
						<?php if ( $logo ) : ?><img src="<?php echo esc_url( $logo ); ?>" alt=""><?php endif; ?>
						<strong><?php echo esc_html( $name ); ?></strong>
					</div>
					<div class="body">
						<div style="background:<?php echo esc_attr( isset( $c['primarySoft'] ) ? $c['primarySoft'] : '#eee' ); ?>;border-radius:<?php echo (int) $s['radius']; ?>px;height:110px;display:flex;align-items:center;justify-content:center;color:<?php echo esc_attr( isset( $c['primaryText'] ) ? $c['primaryText'] : '#000' ); ?>;font-weight:700"><?php esc_html_e( 'Banner', 'storeapp' ); ?></div>
						<div class="card" style="background:<?php echo esc_attr( isset( $c['surface'] ) ? $c['surface'] : '#fff' ); ?>;border-radius:<?php echo (int) $s['radius']; ?>px;border:1px solid <?php echo esc_attr( isset( $c['border'] ) ? $c['border'] : '#eee' ); ?>">
							<div style="font-weight:700"><?php esc_html_e( 'Product name', 'storeapp' ); ?></div>
							<div style="color:<?php echo esc_attr( isset( $c['primaryText'] ) ? $c['primaryText'] : '#000' ); ?>;font-weight:700;margin-top:4px"><?php echo wp_kses_post( class_exists( 'WooCommerce' ) ? wc_price( 1250 ) : '1250' ); ?></div>
							<div style="color:<?php echo esc_attr( isset( $c['muted'] ) ? $c['muted'] : '#777' ); ?>;font-size:12px"><?php esc_html_e( 'Muted text', 'storeapp' ); ?></div>
						</div>
						<span class="btn" style="background:<?php echo esc_attr( isset( $c['primary'] ) ? $c['primary'] : '#000' ); ?>;color:<?php echo esc_attr( isset( $c['onPrimary'] ) ? $c['onPrimary'] : '#fff' ); ?>;border-radius:<?php echo (int) $s['radius']; ?>px"><?php esc_html_e( 'Add to cart', 'storeapp' ); ?></span>
						<span class="btn" style="background:<?php echo esc_attr( isset( $c['secondary'] ) ? $c['secondary'] : '#ccc' ); ?>;color:<?php echo esc_attr( isset( $c['onSecondary'] ) ? $c['onSecondary'] : '#000' ); ?>;border-radius:<?php echo (int) $s['radius']; ?>px"><?php esc_html_e( 'Secondary', 'storeapp' ); ?></span>
					</div>
				</div>
				<div class="sa-card" style="margin-top:20px">
					<h2><?php esc_html_e( 'Connection', 'storeapp' ); ?></h2>
					<p><?php esc_html_e( 'Site URL for the app build:', 'storeapp' ); ?><br><code><?php echo esc_html( home_url() ); ?></code></p>
					<?php foreach ( self::checks() as $chk ) : ?>
						<div class="<?php echo $chk[1] ? 'sa-ok' : 'sa-bad'; ?>"><?php echo $chk[1] ? '✔' : '✖'; ?> <?php echo esc_html( $chk[0] ); ?></div>
					<?php endforeach; ?>
					<p><a href="<?php echo esc_url( rest_url( STOREAPP_NS . '/config' ) ); ?>" target="_blank"><?php esc_html_e( 'View app config JSON', 'storeapp' ); ?></a></p>
				</div>
			</div>
			</div>
		</div>
		<?php
	}

	private static function banners_for_js( $banners ) {
		$out = array();
		foreach ( (array) $banners as $b ) {
			$b['preview'] = ! empty( $b['image_id'] ) ? wp_get_attachment_image_url( (int) $b['image_id'], 'medium' ) : '';
			$out[]        = $b;
		}
		return $out;
	}

	public static function save() {
		if ( ! current_user_can( 'manage_woocommerce' ) || ! check_admin_referer( 'storeapp_save' ) ) {
			wp_die( 'Not allowed' );
		}
		$p   = wp_unslash( $_POST );
		$out = array();
		foreach ( array( 'app_name', 'heading_font', 'body_font', 'notice', 'phone', 'whatsapp', 'email', 'facebook' ) as $k ) {
			$out[ $k ] = isset( $p[ $k ] ) ? sanitize_text_field( $p[ $k ] ) : '';
		}
		foreach ( array( 'primary', 'secondary', 'background', 'text' ) as $k ) {
			$out[ $k ] = isset( $p[ $k ] ) ? (string) sanitize_hex_color( $p[ $k ] ) : '';
		}
		$out['logo_id']   = isset( $p['logo_id'] ) ? absint( $p['logo_id'] ) : 0;
		$out['radius']    = isset( $p['radius'] ) ? max( 0, min( 28, (int) $p['radius'] ) ) : 14;
		$out['dark_mode'] = isset( $p['dark_mode'] ) && in_array( $p['dark_mode'], array( 'auto', 'light', 'dark' ), true ) ? $p['dark_mode'] : 'auto';
		$out['language']  = isset( $p['language'] ) && 'bn' === $p['language'] ? 'bn' : 'en';
		$out['email_optional'] = isset( $p['email_optional'] ) && in_array( $p['email_optional'], array( 'auto', 'yes', 'no' ), true ) ? $p['email_optional'] : 'auto';
		foreach ( array( 'registration', 'wishlist', 'reviews', 'coupons', 'push_order_status', 'classic_bridge' ) as $k ) {
			$out[ $k ] = isset( $p[ $k ] ) ? 'yes' : 'no';
		}

		$banners = json_decode( isset( $p['banners'] ) ? $p['banners'] : '[]', true );
		$out['banners'] = array();
		foreach ( is_array( $banners ) ? $banners : array() as $b ) {
			if ( empty( $b['image_id'] ) ) {
				continue;
			}
			$out['banners'][] = array(
				'image_id'   => absint( $b['image_id'] ),
				'link_type'  => in_array( isset( $b['link_type'] ) ? $b['link_type'] : '', array( 'none', 'product', 'category', 'url', 'search' ), true ) ? $b['link_type'] : 'none',
				'link_value' => sanitize_text_field( isset( $b['link_value'] ) ? $b['link_value'] : '' ),
			);
		}
		$sections = json_decode( isset( $p['sections'] ) ? $p['sections'] : '[]', true );
		$out['sections'] = array();
		foreach ( is_array( $sections ) ? $sections : array() as $sec ) {
			$type = isset( $sec['type'] ) ? $sec['type'] : '';
			if ( ! in_array( $type, array( 'banners', 'categories', 'products' ), true ) ) {
				continue;
			}
			$out['sections'][] = array(
				'type'     => $type,
				'title'    => sanitize_text_field( isset( $sec['title'] ) ? $sec['title'] : '' ),
				'source'   => in_array( isset( $sec['source'] ) ? $sec['source'] : '', array( 'latest', 'sale', 'featured', 'popular', 'rating', 'category' ), true ) ? $sec['source'] : 'latest',
				'category' => absint( isset( $sec['category'] ) ? $sec['category'] : 0 ),
				'limit'    => max( 2, min( 20, (int) ( isset( $sec['limit'] ) ? $sec['limit'] : 10 ) ) ),
				'layout'   => isset( $sec['layout'] ) && 'grid' === $sec['layout'] ? 'grid' : 'carousel',
			);
		}

		StoreApp_Settings::update( $out );
		delete_transient( 'storeapp_config' );
		wp_safe_redirect( admin_url( 'admin.php?page=storeapp&saved=settings' ) );
		exit;
	}

	public static function push() {
		if ( ! current_user_can( 'manage_woocommerce' ) || ! check_admin_referer( 'storeapp_push' ) ) {
			wp_die( 'Not allowed' );
		}
		$p     = wp_unslash( $_POST );
		$title = sanitize_text_field( isset( $p['title'] ) ? $p['title'] : '' );
		$body  = sanitize_textarea_field( isset( $p['body'] ) ? $p['body'] : '' );
		$type  = sanitize_key( isset( $p['link_type'] ) ? $p['link_type'] : 'none' );
		$value = sanitize_text_field( isset( $p['link_value'] ) ? $p['link_value'] : '' );
		if ( $title && $body ) {
			StoreApp_Push::broadcast( $title, $body, array( 'type' => $type, 'value' => $value ) );
		}
		wp_safe_redirect( admin_url( 'admin.php?page=storeapp&saved=push' ) );
		exit;
	}
}
