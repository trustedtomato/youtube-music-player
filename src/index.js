import Sortable from 'sortablejs'

/*--- YouTube API wrappers  ---*/
// ouch why is this YouTube iframe api so bad...
const createYtPlayer = (videoId, container) => new Promise((resolve, reject) => {
	const el = document.createElement('iframe');
	el.frameBorder = 0;
	el.setAttribute('allow', 'accelerometer; autoplay; encrypted-media; gyroscope');
	el.setAttribute('donotallowfullscreen', '');
	el.src = 'https://www.youtube.com/embed/' + videoId + '?disablekb=1&enablejsapi=1&controls=0&origin=' + encodeURIComponent(window.origin);
	console.log('creating a yt player...');
	el.style.display = 'none';
	container.appendChild(el);

	const _reject = err => {
		console.error('error on yt player creation, removing element...');
		container.removeChild(el);
		reject(err);
	};
	
	const player = new YT.Player(el, {
		playerVars: {
			controls: 0,
			origin: window.origin,
			fs: 0,
			disablekb: 1
		},
		events: {
			'onReady': () => {
				setBestSoundQuality(player);
				player.setVolume(100);
				if(player.getVideoData().title){
					el.style.display = '';
					resolve(player);
				}else{
					// if the title is falsy, there must be something wrong (onError doesn't seem to work)
					_reject(1);
				}
			},
			'onError': ({data}) => {
				_reject(data);
			}
		}
	});
});

const destroyYtPlayer = player => {
	// currently, the doc says that the destroy method just removes the iframe
	// but IRL it replaces it with a div, which is not desired,
	// so I just remove the iframe instead.
	console.log('removing iframe...');
	player.getIframe().remove();
};

const setBestSoundQuality = player => {
	// the best sound quality is at 720p and up
	player.setPlaybackQuality('hd720');
};

const getYtVideoTitle = (function(){
	const inv = document.createElement('div');
	inv.style.display = 'none';
	document.body.appendChild(inv);
	return videoId => createYtPlayer(videoId, inv)
		.then(player => {
			const title = player.getVideoData().title;
			destroyYtPlayer(player);
			return title;
		});
})();

const youtubeApiReady = new Promise(resolve => {
	window.onYouTubeIframeAPIReady = resolve;
});

const getYtVideoId = url =>
	url.searchParams.get('v') || url.pathname.split('/').pop();

const fade = (player, targetVolume) => {
	let volume = player.getVolume();
};


/*--- helper functions ---*/
const parseYtVideoId = input =>
	nullOnCatch(() =>
		// if its not a valid url, it will error
		getYtVideoId(new URL(input))
	) || input;

const last = arr => arr[arr.length - 1];

const expFunc = x => Math.cos(x * 0.5 * Math.PI);

const nullOnCatch = func => {
	try{
		return func();
	}catch(err){
		return null;
	}
};

customElements.define('li-track', class extends HTMLLIElement{
	constructor(){
		super();
	}
	createYtPlayer(container){
		return createYtPlayer(this.dataset.id, container);
	}
	getTitle(){
		return getYtVideoTitle(this.dataset.id);
	}
	connectedCallback(){
		// if already initalized in this document, just return
		if(this.children.length > 0) return;

		const id = this.dataset.id;
		const template = document.getElementById('li-track-template');
		const children = document.importNode(template.content, true);

		const text = children.querySelector('.text');
		text.textContent = `Loading ${id}...`;
		this.getTitle()
			.then(title => {
				text.textContent = title;
			})
			.catch(err => {
				console.error('cannot load player because of:', err);
				this.remove();
			});
		this.appendChild(children);
	}
},{extends: 'li'});

customElements.define('ul-playlist', class extends HTMLUListElement{
	constructor(){
		super();
	}
	connectedCallback(){
		this.videoContainer = document.getElementById(this.dataset.videoContainer);
		this.players = [];
		this.playing = false;
		this.currentChild = null;
		Sortable.create(this, {
			animation: 150,
			scrollSpeed: 2,
			filter: '.remove',
			onFilter: e => {
				if(this.currentChild === e.item){
					this.next();
				}
				e.item.remove();
			}
		});
		// detect
		new MutationObserver(mutations => {
			// the currentChild might still be there just elsewhere
			if(this.contains(this.currentChild)) return;
			for(const mutation of mutations){
				if([...mutation.removedNodes].some(removedNode =>
					removedNode === this.currentChild
				)){
					console.log('removed current node, starting next one');
					// previous/next sibling might be a text node, so I had to be tricky here
					this.start(this.nextElement(mutation.previousSibling));
				}
			}
		}).observe(this, {childList: true});
	}
	fade(){
		if(this.fading) return;
		this.fading = true;
		const fadeStates = new WeakMap();

		for(const player of this.players){
			fadeStates.set(player, {
				volume: player.getVolume()
			});
		}
	}
	nextElement(child){
		return (child && child.nextElementSibling) || this.firstElementChild;
	}
	prevElement(child){
		return (child && child.previousElementSibling) || this.lastElementChild;
	}
	start(child){
		clearTimeout(this.endTimeout);
		if(this.currentChild){
			delete this.currentChild.dataset.playing;
		}
		this.currentChild = child;
		console.log(child);
		if(child === null){
			this.players.forEach(destroyYtPlayer);
			return false;
		}
		child.dataset.playing = true;
		child.createYtPlayer(this.videoContainer).then(async player => {
			this.players.forEach(destroyYtPlayer);
			this.players = [player];
			player.addEventListener('onStateChange', e => {
				switch(e.data){
					case YT.PlayerState.PLAYING:
						this.play();
						break;
					case YT.PlayerState.PAUSED:
						this.pause();
						break;
				}
			});
			console.log('playing: ' + this.playing);
			if(this.playing){
				this._play();
			}
		});
	}
	add(id){
		const child = document.createElement('li', {is: 'li-track'});
		child.dataset.id = id;
		this.appendChild(child);
		if(this.currentChild === null){
			this.start(child);
		}
	}
	pause(){
		if(!this.playing) return;
		clearTimeout(this.endTimeout);
		this.playing = false;
		this.dispatchEvent(new Event('pause'));
		for(const player of this.players){
			player.pauseVideo();
		}
	}
	_play(){
		if(this.players.length === 0) return;
		const player = last(this.players);
		this.endTimeout = setTimeout(() => {
			this.start(this.nextElement(this.currentChild));
		}, (player.getDuration() - player.getCurrentTime()) * 1000);
		for(const player of this.players){
			player.playVideo();
		}
		console.log('started playing!');
	}
	play(){
		if(this.playing) return;
		this.playing = true;
		this.dispatchEvent(new Event('play'));
		this._play();
	}
	togglePlay(){
		if(this.playing){
			this.pause();
		}else{
			this.play();
		}
	}
	prev(){
		return this.start(this.prevElement(this.currentChild));
	}
	next(){
		return this.start(this.nextElement(this.currentChild));
	}
},{extends: 'ul'});

const ytIdRegex = /^[-_0-9A-Za-z]{11}$/;


/*--- the big bang ---*/
(async function(){
	await youtubeApiReady;

	const playlistUl = document.querySelector('ul');
	const addForm = document.getElementById('add-form');
	const addInput = document.getElementById('add-input');

	addForm.addEventListener('submit', e => {
		e.preventDefault();
		const id = parseYtVideoId(addInput.value);
		if(typeof id === 'string' && ytIdRegex.test(id)){
			playlistUl.add(id);
		}else{
			console.error('invalid id:', id);
		}
	});

	const prev = document.getElementById('prev');
	const next = document.getElementById('next');
	const play = document.getElementById('play');
	prev.addEventListener('click', () => {
		playlistUl.prev();
	});
	next.addEventListener('click', () => {
		playlistUl.next();
	});
	play.addEventListener('click', () => {
		playlistUl.togglePlay();
	});
	playlistUl.addEventListener('play', () => {
		play.textContent = 'pause';
	});
	playlistUl.addEventListener('pause', () => {
		play.textContent = 'play_arrow';
	});
})();