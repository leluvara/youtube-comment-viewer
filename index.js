// Registering Service Worker
if ('serviceWorker' in navigator) {
	navigator.serviceWorker.register('./sw.js');
}

function getMeta(metaName) {
	var metas = document.getElementsByTagName('meta');

	for (var i = 0; i < metas.length; i++) {
		if (metas[i].getAttribute('name') === metaName) {
			return metas[i];
		}
	}
	return false;
}

function toggleNightMode() {
	document.body.classList.toggle('night-mode');
	if (document.body.classList.contains('night-mode')) {
		getMeta('theme-color').setAttribute('content', '#111111');
		getMeta('background-color').setAttribute('content', '#111111');
		getMeta('msapplication-navbutton-color').setAttribute('content', '#111111');
		getMeta('apple-mobile-web-app-status-bar-style').setAttribute(
			'content',
			'black-translucent'
		);
	} else {
		getMeta('theme-color').setAttribute('content', '#ffffff');
		getMeta('background-color').setAttribute('content', '#ffffff');
		getMeta('msapplication-navbutton-color').setAttribute('content', '#ffffff');
		getMeta('apple-mobile-web-app-status-bar-style').setAttribute(
			'content',
			'default'
		);
	}
}

function toggleLocalStorage(item) {
	if (Modernizr.localstorage) {
		if (
			localStorage.getItem(item) === null ||
			localStorage.getItem(item) === 'false'
		)
			localStorage.setItem(item, 'true');
		else localStorage.setItem(item, 'false');
	}
}

function emptyNode(node) {
	if (node) {
		while (node.firstChild) {
			node.removeChild(node.firstChild);
		}
	}
}

function youtube_url_parser(url) {
	var regExp =
		/^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
	var match = url.match(regExp);
	if (match && match[2].length == 11) return match[2];
	return false;
}

function isNormalInteger(str) {
	var n = Math.floor(Number(str));
	return n !== Infinity && String(n) === str && n > 0;
}

var oldSend = XMLHttpRequest.prototype.send;
var requests = [];

XMLHttpRequest.prototype.send = function () {
	oldSend.apply(this, arguments);

	this.addEventListener(
		'readystatechange',
		function () {
			if (this.readyState === XMLHttpRequest.DONE) {
				var idx = requests.indexOf(this);
				if (idx > -1) requests.splice(idx, 1);
			}
		},
		false
	);
};

function get(url, callback, error) {
	var xhr = new XMLHttpRequest();

	xhr.open('GET', url, true);

	if (url.indexOf('googleapis.com/youtube/v3/') !== -1) {
		requests.push(xhr);
	}

	xhr.onload = function () {
		if (this.status == 200) {
			var data = JSON.parse(this.responseText);
			if (data.items.length > 0 || data.nextPageToken) callback(data);
			else error('Check video URL or ID. Status ' + this.status);
		} else {
			error('Status ' + this.status);
		}

		if (requests.length < 1 && pages.length > 0) {
			render(pages[currentPage]);
		}
	};

	xhr.onerror = function () {
		error('Failed XMLHttpRequest. Status ', this.status);
	};

	xhr.send();
}
function request(api, params, apikey, callback, error) {
	var url = 'https://www.googleapis.com/youtube/v3/' + api + '?key=' + apikey;
	for (var key in params) {
		url += '&' + key + '=' + params[key];
	}
	get(url, callback, error);
}

function myError(message) {
	document.getElementById('error').textContent = message;
	document.body.classList.add('error');
}

var BASE_SET_TIMEOUT = 100,
	MAX_COMMENTS_PER_PAGE = 1000,
	prev,
	next,
	id,
	commentsPerPage,
	apikey,
	pageReplyCount,
	pageCommentCount,
	token,
	pages,
	currentPage,
	maxPage,
	loadingProgress = 0,
	loadingMax = 0,
	loadBtn,
	urlDom,
	apiDom,
	saveBtn,
	apinfo,
	sessionToggle,
	sortBtn,
	video;

function init() {
	pages = [];
	currentPage = -1;
	maxPage = -1;
	token = '';
}

function updateLoader(progress, max) {
	if (!max) max = 100;
	document.getElementById('loader').textContent = Math.min(
		Math.round((progress * 100) / max),
		100
	);
}

function getPage(data) {
	var page = [];

	loadingProgress = 0;
	updateLoader(0);
	loadingMax = parseInt(commentsPerPage, 10);

	pages.push(page);
	getComments(data);
}

function getComments(data) {
	if (data) {
		if (data.kind === 'youtube#commentThreadListResponse') {
			if (data.items.length > 0) {
				for (var i = 0; i < data.items.length; i++) {
					if (data.items[i].snippet.totalReplyCount > 0) {
						loadingMax += parseInt(data.items[i].snippet.totalReplyCount, 10);
						updateLoader(loadingProgress, loadingMax);

						data.items[i].snippet.topLevelComment.replies = [];
						getReplies(data.items[i].snippet.topLevelComment.id);
					}
					pages[currentPage].push(data.items[i].snippet);
				}

				loadingProgress += data.items.length;
				updateLoader(loadingProgress, loadingMax);
			}
			if (data.nextPageToken) {
				token = data.nextPageToken;
			} else {
				token = false;
				if (loadingProgress < loadingMax) {
					loadingMax = loadingProgress;
					updateLoader(loadingProgress, loadingMax);
				}
			}
		}
	}
	if (token !== false) {
		if (pages[currentPage].length < commentsPerPage) {
			request(
				'commentThreads',
				{
					textFormat: 'plainText',
					part: 'snippet',
					videoId: id,
					maxResults: Math.min(
						100,
						commentsPerPage - pages[currentPage].length
					),
					pageToken: token,
				},
				apikey,
				getComments,
				myError
			);
		}
	}
}

function getReplies(cid, nextRepliesPageToken) {
	if (!nextRepliesPageToken) nextRepliesPageToken = '';

	request(
		'comments',
		{
			textFormat: 'plainText',
			part: 'snippet',
			parentId: cid,
			maxResults: '100',
			pageToken: nextRepliesPageToken,
		},
		apikey,
		function (data) {
			if (data) {
				if (data.items) {
					if (data.items.length > 0) {
						loadingProgress += data.items.length;
						updateLoader(loadingProgress, loadingMax);

						for (var i = 0; i < pages[currentPage].length; i++) {
							if (pages[currentPage][i].topLevelComment.id == cid)
								pages[currentPage][i].topLevelComment.replies = pages[
									currentPage
								][i].topLevelComment.replies.concat(data.items);
						}
					}
				}

				if (data.nextPageToken) getReplies(cid, data.nextPageToken);
			}
		},
		myError
	);
}

var pageDom = document.createDocumentFragment();

function render(page) {
	pageCommentCount = 0;
	pageReplyCount = 0;

	for (var i = 0; i < page.length; i++) {
		pageDom.appendChild(commentDom(page[i]));
		pageCommentCount++;
	}

	emptyNode(document.getElementById('comments'));
	document.getElementById('comments').appendChild(pageDom);

	document.getElementById('currentPage').textContent = currentPage + 1;

	document.getElementById('pageCommentCount').textContent = pageCommentCount;
	document.getElementById('pageReplyCount').textContent = pageReplyCount;

	if (token == false) {
		if (document.body.classList.contains('next-page-loadable'))
			document.body.classList.remove('next-page-loadable');
	} else {
		if (currentPage >= maxPage)
			document.body.classList.add('next-page-loadable');
		else document.body.classList.remove('next-page-loadable');
	}

	enablePagination();
	removeLoading();

	if (!document.body.classList.contains('session'))
		document.body.classList.add('session');
}

function commentDom(comment) {
	if (comment.topLevelComment) {
		comment = comment.topLevelComment;
	}

	var container = document.createElement('div');
	container.classList.add('comment');
	var meta = document.createElement('div');
	meta.classList.add('comment-meta');

	var author = document.createElement('a');
	author.classList.add('comment-author');
	if (comment.snippet.authorChannelId) {
		if (comment.snippet.authorChannelId.value) {
			if (comment.snippet.authorChannelId.value === video.snippet.channelId)
				author.classList.add('video-author');
		}
	}
	author.setAttribute('href', comment.snippet.authorChannelUrl);
	author.appendChild(
		document.createTextNode(comment.snippet.authorDisplayName)
	);
	meta.appendChild(author);

	if (comment.snippet.likeCount > 0) {
		var likes = document.createElement('span');
		likes.classList.add('comment-likes');
		likes.appendChild(document.createTextNode(comment.snippet.likeCount));
		meta.appendChild(likes);
	}

	var date = document.createElement('span');
	date.classList.add('comment-date');
	date.appendChild(
		document.createTextNode(
			Object(new Date(comment.snippet.publishedAt)).toLocaleDateString([], {
				hour: '2-digit',
				minute: '2-digit',
			})
		)
	);
	meta.appendChild(date);

	var content = document.createElement('div');
	content.classList.add('comment-content');
	content.appendChild(document.createTextNode(comment.snippet.textDisplay));

	container.appendChild(meta);
	container.appendChild(content);

	if (comment.replies) {
		var replies = document.createElement('div');
		replies.classList.add('comment-replies');
		for (var j = comment.replies.length - 1; j >= 0; j--) {
			replies.appendChild(commentDom(comment.replies[j]));
			pageReplyCount++;
		}
		container.appendChild(replies);
	}

	return container;
}

function addLoading() {
	document.body.classList.add('loading');
}
function removeLoading() {
	document.body.classList.remove('loading');
}

function enablePagination() {
	document.getElementById('settingsToggle').removeAttribute('disabled');
	sortBtn.removeAttribute('disabled');
	sessionToggle.removeAttribute('disabled');
	if (currentPage > 0) prev.removeAttribute('disabled');

	if (token == false && currentPage >= maxPage) {
	} else {
		next.removeAttribute('disabled');
	}
}
function disablePagination() {
	document.getElementById('settingsToggle').setAttribute('disabled', '');
	sortBtn.setAttribute('disabled', '');
	sessionToggle.setAttribute('disabled', '');
	prev.setAttribute('disabled', '');
	next.setAttribute('disabled', '');
}

function prevClick() {
	updateLoader(100);
	addLoading();
	disablePagination();
	setTimeout(function () {
		if (currentPage > 0) {
			currentPage--;
			render(pages[currentPage]);
		} else {
			enablePagination();
			removeLoading();
		}
	}, BASE_SET_TIMEOUT);
}

function nextClick() {
	if (document.body.classList.contains('next-page-loadable')) updateLoader(0);
	else updateLoader(100);
	addLoading();
	disablePagination();
	setTimeout(function () {
		if (token == false) {
			if (currentPage + 1 < pages.length) {
				currentPage++;
				render(pages[currentPage]);
			} else {
				enablePagination();
				removeLoading();
			}
		} else {
			currentPage++;
			if (currentPage > maxPage) {
				maxPage = currentPage;
				getPage();
			} else {
				render(pages[currentPage]);
				removeLoading();
			}
		}
	}, BASE_SET_TIMEOUT);
}

function firstLoad(data) {
	video = data.items[0];

	var videoUrl = 'https://youtu.be/' + video.id;

	document.getElementById('videoUrl').setAttribute('href', videoUrl);

	document
		.getElementById('videoThumbnail')
		.setAttribute('src', video.snippet.thumbnails.medium.url);

	document.getElementById('videoTitle').textContent = video.snippet.title;
	document.getElementById('videoTotalComments').textContent =
		video.statistics.commentCount;

	if (!document.body.classList.contains('session'))
		document.body.classList.add('session');

	getPage(data);
}

window.onload = function () {
	sessionToggle = document.getElementById('sessionToggle');

	urlDom = document.getElementById('url');
	loadBtn = document.getElementById('load');

	prev = document.getElementById('prev');
	next = document.getElementById('next');

	apiDom = document.getElementById('api');
	saveBtn = document.getElementById('saveapi');
	apinfo = document.getElementById('apinfo');

	sortBtn = document.getElementById('sort');

	if (Modernizr.localstorage) {
		if (localStorage.getItem('largetext') === 'true') {
			document.getElementById('largeText').checked = true;
			document.getElementsByTagName('html')[0].classList.add('large-text');
		}
		if (localStorage.getItem('hidemeta') === 'false') {
			document.getElementById('metaToggle').checked = false;
			document.body.classList.add('hide-meta');
		}
		if (localStorage.getItem('nightmode') === 'true') {
			document.getElementById('nightToggle').checked = true;
			toggleNightMode();
		}
		if (localStorage.getItem('hidescrolltop') === 'false') {
			document.getElementById('scrollToggle').checked = false;
			document.body.classList.add('hide-scroll-top');
		}

		if (localStorage.getItem('reverse') === 'true') {
			sortBtn.textContent = 'Old first';
			document.body.classList.add('reverse');
		}

		if (localStorage.getItem('comments'))
			document.getElementById('number').value =
				localStorage.getItem('comments');

		if (localStorage.getItem('apikey')) {
			apiDom.value = localStorage.getItem('apikey');
			apiDom.setAttribute('disabled', '');
			saveBtn.textContent = 'Edit';
			saveBtn.classList.add('edit');
		}
	}

	if (urlDom.value.length > 0 && apiDom.value.length > 0)
		loadBtn.removeAttribute('disabled');

	urlDom.addEventListener('input', function () {
		if (this.value.length > 0 && apiDom.value.length > 0)
			loadBtn.removeAttribute('disabled');
		else loadBtn.setAttribute('disabled', '');
	});

	if (apiDom.value.length < 1) {
		apiDom.classList.add('attention');
		loadBtn.setAttribute('disabled', '');
	} else {
		apinfo.classList.add('hide');
	}

	apiDom.addEventListener('input', function () {
		if (this.value.length > 0 && urlDom.value.length > 0)
			loadBtn.removeAttribute('disabled');
		else loadBtn.setAttribute('disabled', '');
	});

	apiDom.addEventListener('focus', function () {
		this.classList.remove('attention');
	});

	apiDom.addEventListener('focusout', function () {
		if (this.value.length < 1) {
			this.classList.add('attention');
			loadBtn.setAttribute('disabled', '');
			apinfo.classList.remove('hide');
		} else {
			this.classList.remove('attention');
			apinfo.classList.add('hide');
			if (urlDom.value.length > 0) loadBtn.removeAttribute('disabled');
		}
	});

	saveBtn.addEventListener('click', function () {
		if (Modernizr.localstorage) {
			if (apiDom.hasAttribute('disabled')) {
				apiDom.removeAttribute('disabled');
				this.textContent = 'Save';
				this.classList.remove('edit');
			} else if (apiDom.value.length > 0) {
				apiDom.setAttribute('disabled', '');
				this.textContent = 'Edit';
				this.classList.add('edit');
				localStorage.setItem('apikey', apiDom.value);
			}
		}
	});

	sortBtn.addEventListener('click', function () {
		toggleLocalStorage('reverse');
		if (document.body.classList.contains('reverse')) {
			sortBtn.textContent = 'New first';
			document.body.classList.remove('reverse');
		} else {
			sortBtn.textContent = 'Old first';
			document.body.classList.add('reverse');
		}
	});

	loadBtn.addEventListener('click', function () {
		init();

		document.body.classList.remove('error');

		id = urlDom.value;

		commentsPerPage = document.getElementById('number').value;

		if (isNormalInteger(commentsPerPage)) {
			if (commentsPerPage > MAX_COMMENTS_PER_PAGE)
				commentsPerPage = MAX_COMMENTS_PER_PAGE;
		} else {
			commentsPerPage = 100;
		}

		if (Modernizr.localstorage)
			localStorage.setItem('comments', commentsPerPage);

		apikey = apiDom.value;

		currentPage = 0;

		addLoading();
		disablePagination();

		request(
			'videos',
			{
				part: 'snippet,statistics',
				id: id,
			},
			apikey,
			firstLoad,
			function () {
				id = youtube_url_parser(id);
				request(
					'videos',
					{
						part: 'snippet,statistics',
						id: id,
					},
					apikey,
					firstLoad,
					myError
				);
			}
		);
	});

	prev.addEventListener('click', prevClick);
	next.addEventListener('click', nextClick);

	sessionToggle.addEventListener('click', function () {
		updateLoader(100);
		addLoading();
		disablePagination();
		setTimeout(function () {
			document.body.classList.toggle('session');
			removeLoading();
			enablePagination();
		}, BASE_SET_TIMEOUT);
	});

	document
		.getElementById('settingsToggle')
		.addEventListener('click', function () {
			document.body.classList.toggle('settings');
		});

	document.getElementById('largeText').addEventListener('click', function () {
		document.getElementsByTagName('html')[0].classList.toggle('large-text');
		toggleLocalStorage('largetext');
	});

	document.getElementById('metaToggle').addEventListener('click', function () {
		document.body.classList.toggle('hide-meta');
		toggleLocalStorage('hidemeta');
	});

	document.getElementById('nightToggle').addEventListener('click', function () {
		toggleNightMode();
		toggleLocalStorage('nightmode');
	});

	document
		.getElementById('scrollToggle')
		.addEventListener('click', function () {
			document.body.classList.toggle('hide-scroll-top');
			toggleLocalStorage('hidescrolltop');
		});
};
