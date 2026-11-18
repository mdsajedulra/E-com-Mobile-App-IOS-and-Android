/* StoreApp admin: color pickers, logo picker, banner + section repeaters. */
jQuery(function ($) {
	$('.sa-color').wpColorPicker();

	function pickImage(cb) {
		var frame = wp.media({ title: 'Choose image', multiple: false, library: { type: 'image' } });
		frame.on('select', function () {
			var a = frame.state().get('selection').first().toJSON();
			cb(a.id, (a.sizes && a.sizes.medium ? a.sizes.medium.url : a.url));
		});
		frame.open();
	}

	$('#sa-logo-pick').on('click', function () {
		pickImage(function (id, url) { $('#sa-logo-id').val(id); $('#sa-logo-preview').attr('src', url); });
	});
	$('#sa-logo-clear').on('click', function () { $('#sa-logo-id').val(0); $('#sa-logo-preview').attr('src', ''); });

	var cats = (window.StoreAppAdmin && StoreAppAdmin.categories) || [];
	function esc(s) { return $('<div>').text(s == null ? '' : String(s)).html(); }
	function catOptions(sel) {
		return cats.map(function (c) { return '<option value="' + c.id + '"' + (String(c.id) === String(sel) ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('');
	}
	function opts(list, sel) {
		return list.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === sel ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('');
	}
	function moveBtns() {
		return '<button type="button" class="button sa-up">↑</button><button type="button" class="button sa-down">↓</button><button type="button" class="button-link sa-del" style="color:#d63638">Remove</button>';
	}

	/* ---------- Banners ---------- */
	var banners = JSON.parse($('#sa-banners').val() || '[]');
	function renderBanners() {
		var $l = $('#sa-banner-list').empty();
		banners.forEach(function (b, i) {
			$l.append(
				'<div class="sa-item" data-i="' + i + '">' +
				'<img src="' + esc(b.preview || '') + '">' +
				'<button type="button" class="button sa-b-img">Image</button>' +
				'<select class="sa-b-type">' + opts([['none', 'No link'], ['product', 'Product ID'], ['category', 'Category'], ['url', 'URL'], ['search', 'Search text']], b.link_type || 'none') + '</select>' +
				(b.link_type === 'category'
					? '<select class="sa-b-val">' + catOptions(b.link_value) + '</select>'
					: '<input type="text" class="sa-b-val" value="' + esc(b.link_value || '') + '" placeholder="Value">') +
				moveBtns() + '</div>'
			);
		});
		$('#sa-banners').val(JSON.stringify(banners));
	}
	$('#sa-banner-add').on('click', function () {
		pickImage(function (id, url) { banners.push({ image_id: id, preview: url, link_type: 'none', link_value: '' }); renderBanners(); });
	});
	$('#sa-banner-list')
		.on('click', '.sa-b-img', function () {
			var i = $(this).closest('.sa-item').data('i');
			pickImage(function (id, url) { banners[i].image_id = id; banners[i].preview = url; renderBanners(); });
		})
		.on('change', '.sa-b-type', function () { var i = $(this).closest('.sa-item').data('i'); banners[i].link_type = this.value; banners[i].link_value = ''; renderBanners(); })
		.on('change keyup', '.sa-b-val', function () { var i = $(this).closest('.sa-item').data('i'); banners[i].link_value = this.value; $('#sa-banners').val(JSON.stringify(banners)); });
	bindMove('#sa-banner-list', function () { return banners; }, renderBanners);

	/* ---------- Sections ---------- */
	var sections = JSON.parse($('#sa-sections').val() || '[]');
	function renderSections() {
		var $l = $('#sa-section-list').empty();
		sections.forEach(function (s, i) {
			var html = '<div class="sa-item" data-i="' + i + '">' +
				'<select class="sa-s-f" data-f="type">' + opts([['banners', 'Banner slider'], ['categories', 'Categories'], ['products', 'Products']], s.type) + '</select>';
			if (s.type !== 'banners') {
				html += '<input type="text" class="sa-s-f" data-f="title" value="' + esc(s.title || '') + '" placeholder="Title">';
			}
			if (s.type === 'products') {
				html += '<select class="sa-s-f" data-f="source">' + opts([['latest', 'Newest'], ['sale', 'On sale'], ['featured', 'Featured'], ['popular', 'Best selling'], ['rating', 'Top rated'], ['category', 'From category']], s.source || 'latest') + '</select>';
				if (s.source === 'category') {
					html += '<select class="sa-s-f" data-f="category">' + catOptions(s.category) + '</select>';
				}
				html += '<select class="sa-s-f" data-f="layout">' + opts([['carousel', 'Carousel'], ['grid', 'Grid']], s.layout || 'carousel') + '</select>';
				html += '<input type="number" min="2" max="20" style="width:64px" class="sa-s-f" data-f="limit" value="' + (s.limit || 10) + '">';
			}
			$l.append(html + moveBtns() + '</div>');
		});
		$('#sa-sections').val(JSON.stringify(sections));
	}
	$('#sa-section-add').on('click', function () { sections.push({ type: 'products', title: '', source: 'latest', limit: 10, layout: 'carousel' }); renderSections(); });
	$('#sa-section-list').on('change', '.sa-s-f', function () {
		var i = $(this).closest('.sa-item').data('i'), f = $(this).data('f');
		sections[i][f] = this.value;
		if (f === 'source' && this.value === 'category' && !sections[i].category && cats[0]) { sections[i].category = cats[0].id; }
		renderSections();
	}).on('keyup', 'input.sa-s-f', function () {
		var i = $(this).closest('.sa-item').data('i');
		sections[i][$(this).data('f')] = this.value; $('#sa-sections').val(JSON.stringify(sections));
	});
	bindMove('#sa-section-list', function () { return sections; }, renderSections);

	function bindMove(sel, get, render) {
		$(sel).on('click', '.sa-up,.sa-down,.sa-del', function () {
			var list = get(), i = $(this).closest('.sa-item').data('i');
			if ($(this).hasClass('sa-del')) { list.splice(i, 1); }
			else {
				var j = $(this).hasClass('sa-up') ? i - 1 : i + 1;
				if (j < 0 || j >= list.length) { return; }
				var t = list[i]; list[i] = list[j]; list[j] = t;
			}
			render();
		});
	}

	renderBanners();
	renderSections();
});
