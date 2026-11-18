<?php
/**
 * Auto-detects the store's brand: colors, fonts and logo from the active theme / page builder,
 * then builds an accessible palette (WCAG contrast for text on brand colors).
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class StoreApp_Branding {

	/* ---------------- Color math ---------------- */

	public static function hex( $c ) {
		$c = trim( (string) $c );
		if ( preg_match( '/^#?([0-9a-f]{3})$/i', $c, $m ) ) {
			$s = $m[1];
			return strtoupper( '#' . $s[0] . $s[0] . $s[1] . $s[1] . $s[2] . $s[2] );
		}
		if ( preg_match( '/^#?([0-9a-f]{6})([0-9a-f]{2})?$/i', $c, $m ) ) {
			return strtoupper( '#' . $m[1] );
		}
		if ( preg_match( '/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i', $c, $m ) ) {
			return sprintf( '#%02X%02X%02X', $m[1], $m[2], $m[3] );
		}
		return '';
	}

	public static function rgb( $hex ) {
		$hex = ltrim( self::hex( $hex ), '#' );
		return array( hexdec( substr( $hex, 0, 2 ) ), hexdec( substr( $hex, 2, 2 ) ), hexdec( substr( $hex, 4, 2 ) ) );
	}

	public static function luminance( $hex ) {
		$out = array();
		foreach ( self::rgb( $hex ) as $v ) {
			$v     = $v / 255;
			$out[] = $v <= 0.03928 ? $v / 12.92 : pow( ( $v + 0.055 ) / 1.055, 2.4 );
		}
		return 0.2126 * $out[0] + 0.7152 * $out[1] + 0.0722 * $out[2];
	}

	public static function contrast( $a, $b ) {
		$l1 = self::luminance( $a );
		$l2 = self::luminance( $b );
		return ( max( $l1, $l2 ) + 0.05 ) / ( min( $l1, $l2 ) + 0.05 );
	}

	/** Best readable text color (near-black or white) on a background. */
	public static function on( $bg, $dark = '#111111', $light = '#FFFFFF' ) {
		return self::contrast( $bg, $light ) >= self::contrast( $bg, $dark ) ? $light : $dark;
	}

	public static function mix( $a, $b, $t ) {
		$x = self::rgb( $a );
		$y = self::rgb( $b );
		return sprintf( '#%02X%02X%02X', round( $x[0] + ( $y[0] - $x[0] ) * $t ), round( $x[1] + ( $y[1] - $x[1] ) * $t ), round( $x[2] + ( $y[2] - $x[2] ) * $t ) );
	}

	/** Saturation-ish check so we do not pick grey/white/black as the brand color. */
	public static function is_colorful( $hex ) {
		list( $r, $g, $b ) = self::rgb( $hex );
		$max = max( $r, $g, $b );
		$min = min( $r, $g, $b );
		return ( $max - $min ) > 35 && $max > 40 && $min < 235;
	}

	/* ---------------- Detection ---------------- */

	/**
	 * Candidate colors from the site, most reliable first.
	 * Returns [ 'primary' => [...], 'secondary' => [...], 'background' => [...], 'text' => [...] ].
	 */
	public static function candidates() {
		$c = array( 'primary' => array(), 'secondary' => array(), 'background' => array(), 'text' => array() );

		// 1. Elementor global colors (active kit).
		if ( did_action( 'elementor/loaded' ) && class_exists( '\Elementor\Plugin' ) ) {
			try {
				$kit = \Elementor\Plugin::$instance->kits_manager->get_active_kit_for_frontend();
				if ( $kit ) {
					$s = $kit->get_settings();
					foreach ( (array) ( isset( $s['system_colors'] ) ? $s['system_colors'] : array() ) as $col ) {
						$id = isset( $col['_id'] ) ? $col['_id'] : '';
						$v  = isset( $col['color'] ) ? $col['color'] : '';
						if ( 'primary' === $id ) {
							$c['primary'][] = $v;
						} elseif ( 'secondary' === $id ) {
							$c['secondary'][] = $v;
						} elseif ( 'text' === $id ) {
							$c['text'][] = $v;
						} elseif ( 'accent' === $id ) {
							$c['secondary'][] = $v;
						}
					}
					if ( ! empty( $s['body_background_color'] ) ) {
						$c['background'][] = $s['body_background_color'];
					}
					foreach ( (array) ( isset( $s['custom_colors'] ) ? $s['custom_colors'] : array() ) as $col ) {
						$t = strtolower( isset( $col['title'] ) ? $col['title'] : '' );
						if ( preg_match( '/background|ivory|cream|base|bg/', $t ) && ! empty( $col['color'] ) ) {
							$c['background'][] = $col['color'];
						}
					}
				}
			} catch ( \Throwable $e ) { // phpcs:ignore Generic.CodeAnalysis.EmptyStatement.DetectedCatch
			}
		}

		// 2. Block themes / theme.json palette.
		if ( function_exists( 'wp_get_global_settings' ) ) {
			$palette = wp_get_global_settings( array( 'color', 'palette' ) );
			$flat    = array();
			foreach ( array( 'custom', 'theme' ) as $origin ) {
				if ( ! empty( $palette[ $origin ] ) ) {
					foreach ( $palette[ $origin ] as $p ) {
						$flat[ $p['slug'] ] = $p['color'];
					}
				}
			}
			foreach ( array( 'primary', 'accent', 'accent-1', 'vivid-cyan-blue' ) as $slug ) {
				if ( isset( $flat[ $slug ] ) ) {
					$c['primary'][] = $flat[ $slug ];
				}
			}
			foreach ( array( 'secondary', 'accent-2' ) as $slug ) {
				if ( isset( $flat[ $slug ] ) ) {
					$c['secondary'][] = $flat[ $slug ];
				}
			}
			foreach ( array( 'base', 'background' ) as $slug ) {
				if ( isset( $flat[ $slug ] ) ) {
					$c['background'][] = $flat[ $slug ];
				}
			}
			foreach ( array( 'contrast', 'foreground' ) as $slug ) {
				if ( isset( $flat[ $slug ] ) ) {
					$c['text'][] = $flat[ $slug ];
				}
			}
			$styles = function_exists( 'wp_get_global_styles' ) ? wp_get_global_styles( array( 'color' ) ) : array();
			if ( ! empty( $styles['background'] ) && 0 !== strpos( $styles['background'], 'var(' ) ) {
				$c['background'][] = $styles['background'];
			}
		}

		// 3. Popular classic themes.
		$astra = get_option( 'astra-settings' );
		if ( is_array( $astra ) && ! empty( $astra['global-color-palette']['palette'] ) ) {
			$p              = $astra['global-color-palette']['palette'];
			$c['primary'][] = isset( $p[0] ) ? $p[0] : '';
			$c['secondary'][] = isset( $p[1] ) ? $p[1] : '';
			$c['text'][]    = isset( $p[3] ) ? $p[3] : '';
			$c['background'][] = isset( $p[5] ) ? $p[5] : '';
		}
		foreach ( array( 'color_primary', 'primary_color', 'accent_color', 'theme_color', 'link_color' ) as $mod ) {
			$v = get_theme_mod( $mod );
			if ( $v ) {
				$c['primary'][] = $v;
			}
		}
		foreach ( array( 'color_secondary', 'secondary_color' ) as $mod ) {
			$v = get_theme_mod( $mod );
			if ( $v ) {
				$c['secondary'][] = $v;
			}
		}
		$woodmart = get_option( 'xts-woodmart-options' );
		if ( is_array( $woodmart ) && ! empty( $woodmart['primary-color']['idle'] ) ) {
			$c['primary'][] = $woodmart['primary-color']['idle'];
		}
		$bg = get_theme_mod( 'background_color' );
		if ( $bg ) {
			$c['background'][] = '#' . ltrim( $bg, '#' );
		}

		// 4. WooCommerce email color: every store has it.
		$c['primary'][] = get_option( 'woocommerce_email_base_color' );

		return apply_filters( 'storeapp_brand_candidates', $c );
	}

	private static function pick( $list, $colorful = false ) {
		foreach ( (array) $list as $v ) {
			$h = self::hex( $v );
			if ( $h && ( ! $colorful || self::is_colorful( $h ) ) ) {
				return $h;
			}
		}
		return '';
	}

	public static function detect_fonts() {
		$heading = '';
		$body    = '';
		if ( did_action( 'elementor/loaded' ) && class_exists( '\Elementor\Plugin' ) ) {
			try {
				$kit = \Elementor\Plugin::$instance->kits_manager->get_active_kit_for_frontend();
				$s   = $kit ? $kit->get_settings() : array();
				foreach ( (array) ( isset( $s['system_typography'] ) ? $s['system_typography'] : array() ) as $t ) {
					$id = isset( $t['_id'] ) ? $t['_id'] : '';
					$f  = isset( $t['typography_font_family'] ) ? $t['typography_font_family'] : '';
					if ( 'primary' === $id && $f ) {
						$heading = $f;
					} elseif ( 'text' === $id && $f ) {
						$body = $f;
					}
				}
			} catch ( \Throwable $e ) { // phpcs:ignore Generic.CodeAnalysis.EmptyStatement.DetectedCatch
			}
		}
		if ( ( ! $heading || ! $body ) && function_exists( 'wp_get_global_styles' ) ) {
			$ff = wp_get_global_styles( array( 'typography', 'fontFamily' ) );
			$hf = wp_get_global_styles( array( 'elements', 'heading', 'typography', 'fontFamily' ) );
			$body    = $body ? $body : self::font_from_value( $ff );
			$heading = $heading ? $heading : self::font_from_value( $hf );
		}
		$astra = get_option( 'astra-settings' );
		if ( is_array( $astra ) ) {
			if ( ! $body && ! empty( $astra['body-font-family'] ) && 'inherit' !== $astra['body-font-family'] ) {
				$body = trim( current( explode( ',', $astra['body-font-family'] ) ), "'\" " );
			}
			if ( ! $heading && ! empty( $astra['headings-font-family'] ) && 'inherit' !== $astra['headings-font-family'] ) {
				$heading = trim( current( explode( ',', $astra['headings-font-family'] ) ), "'\" " );
			}
		}
		return array(
			'heading' => $heading ? $heading : $body,
			'body'    => $body ? $body : $heading,
		);
	}

	private static function font_from_value( $v ) {
		if ( ! is_string( $v ) || '' === $v ) {
			return '';
		}
		if ( preg_match( '/var:preset\|font-family\|([a-z0-9-]+)/', $v, $m ) || preg_match( '/--font-family--([a-z0-9-]+)/', $v, $m ) ) {
			$fams = wp_get_global_settings( array( 'typography', 'fontFamilies' ) );
			foreach ( array( 'custom', 'theme' ) as $o ) {
				foreach ( (array) ( isset( $fams[ $o ] ) ? $fams[ $o ] : array() ) as $f ) {
					if ( $f['slug'] === $m[1] ) {
						return trim( current( explode( ',', $f['fontFamily'] ) ), "'\" " );
					}
				}
			}
			return '';
		}
		return trim( current( explode( ',', $v ) ), "'\" " );
	}

	/**
	 * TTF download URLs for a Google Font, so the app can load it at runtime.
	 * Cached for a week. Returns null when the font is not a Google Font.
	 */
	public static function google_font( $family ) {
		$family = trim( (string) $family );
		if ( '' === $family || preg_match( '/^(system-ui|sans-serif|serif|inherit|default)$/i', $family ) ) {
			return null;
		}
		$key    = 'storeapp_gf_' . md5( $family );
		$cached = get_transient( $key );
		if ( false !== $cached ) {
			return $cached ? $cached : null;
		}
		$url = 'https://fonts.googleapis.com/css2?family=' . rawurlencode( $family ) . ':wght@400;600;700&display=swap';
		// A non-browser user agent makes Google return TTF instead of WOFF2 (React Native needs TTF/OTF).
		$res = wp_remote_get( $url, array( 'timeout' => 8, 'user-agent' => 'StoreApp/1.0' ) );
		$out = array();
		if ( ! is_wp_error( $res ) && 200 === wp_remote_retrieve_response_code( $res ) ) {
			$css = wp_remote_retrieve_body( $res );
			if ( preg_match_all( '/font-weight:\s*(\d+);[^}]*?src:\s*url\(([^)]+)\)/s', $css, $m, PREG_SET_ORDER ) ) {
				foreach ( $m as $row ) {
					$out[ $row[1] ] = trim( $row[2], "'\"" );
				}
			}
		}
		$result = $out ? array(
			'family'   => $family,
			'regular'  => isset( $out['400'] ) ? $out['400'] : reset( $out ),
			'semibold' => isset( $out['600'] ) ? $out['600'] : ( isset( $out['700'] ) ? $out['700'] : reset( $out ) ),
			'bold'     => isset( $out['700'] ) ? $out['700'] : end( $out ),
		) : array();
		set_transient( $key, $result, $result ? WEEK_IN_SECONDS : DAY_IN_SECONDS );
		return $result ? $result : null;
	}

	public static function logo_url() {
		$id = (int) StoreApp_Settings::get( 'logo_id' );
		if ( ! $id ) {
			$id = (int) get_theme_mod( 'custom_logo' );
		}
		if ( ! $id && did_action( 'elementor/loaded' ) ) {
			$id = (int) get_option( 'elementor_site_logo' );
		}
		$url = $id ? wp_get_attachment_image_url( $id, 'full' ) : '';
		return $url ? $url : get_site_icon_url( 512 );
	}

	/**
	 * Final theme for the app.
	 */
	public static function theme() {
		$s = StoreApp_Settings::all();
		$c = self::candidates();

		$primary    = self::hex( $s['primary'] ) ? self::hex( $s['primary'] ) : self::pick( $c['primary'], true );
		$primary    = $primary ? $primary : '#111827';
		$secondary  = self::hex( $s['secondary'] ) ? self::hex( $s['secondary'] ) : self::pick( $c['secondary'], true );
		$secondary  = $secondary ? $secondary : self::mix( $primary, '#FFFFFF', 0.35 );
		$background = self::hex( $s['background'] ) ? self::hex( $s['background'] ) : self::pick( $c['background'] );
		$background = $background ? $background : '#FFFFFF';
		$text       = self::hex( $s['text'] ) ? self::hex( $s['text'] ) : self::pick( $c['text'] );
		if ( ! $text || self::contrast( $text, $background ) < 4.5 ) {
			$text = self::on( $background, '#111111', '#FFFFFF' );
		}

		$is_dark_bg = self::luminance( $background ) < 0.2;
		$surface    = $is_dark_bg ? self::mix( $background, '#FFFFFF', 0.06 ) : ( self::luminance( $background ) > 0.95 ? '#FFFFFF' : self::mix( $background, '#FFFFFF', 0.6 ) );

		// Brand color used for text/links on the background must stay readable.
		$primary_text = $primary;
		$i            = 0;
		while ( self::contrast( $primary_text, $background ) < 4.5 && $i < 10 ) {
			$primary_text = self::mix( $primary_text, $is_dark_bg ? '#FFFFFF' : '#000000', 0.15 );
			$i++;
		}

		$fonts   = self::detect_fonts();
		$heading = $s['heading_font'] ? $s['heading_font'] : $fonts['heading'];
		$body    = $s['body_font'] ? $s['body_font'] : $fonts['body'];

		$theme = array(
			'colors' => array(
				'primary'       => $primary,
				'onPrimary'     => self::on( $primary ),
				'primaryText'   => $primary_text,
				'primarySoft'   => self::mix( $primary, $background, 0.88 ),
				'secondary'     => $secondary,
				'onSecondary'   => self::on( $secondary ),
				'background'    => $background,
				'surface'       => $surface,
				'text'          => $text,
				'muted'         => self::mix( $text, $background, 0.45 ),
				'border'        => self::mix( $text, $background, 0.86 ),
				'success'       => '#16A34A',
				'danger'        => '#DC2626',
				'warning'       => '#D97706',
				'sale'          => '#DC2626',
			),
			'dark'   => array(
				'primary'     => $primary,
				'onPrimary'   => self::on( $primary ),
				'primaryText' => self::contrast( $primary, '#0F1115' ) >= 4.5 ? $primary : self::mix( $primary, '#FFFFFF', 0.45 ),
				'primarySoft' => self::mix( $primary, '#0F1115', 0.8 ),
				'secondary'   => $secondary,
				'onSecondary' => self::on( $secondary ),
				'background'  => '#0F1115',
				'surface'     => '#181B21',
				'text'        => '#F3F4F6',
				'muted'       => '#9CA3AF',
				'border'      => '#2A2F38',
				'success'     => '#22C55E',
				'danger'      => '#F87171',
				'warning'     => '#FBBF24',
				'sale'        => '#F87171',
			),
			'mode'   => $s['dark_mode'],
			'radius' => max( 0, min( 28, (int) $s['radius'] ) ),
			'fonts'  => array(
				'heading' => self::google_font( $heading ),
				'body'    => self::google_font( $body ),
			),
		);
		return apply_filters( 'storeapp_theme', $theme );
	}
}
