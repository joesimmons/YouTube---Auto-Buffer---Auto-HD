// ==UserScript==
// @name           YouTube Auto Buffer & Auto HD
// @namespace      http://userscripts.org/users/23652
// @description    Buffers the video without autoplaying and puts it in HD if the option is on. For Firefox, Opera, & Chrome
// @include        http://*.youtube.com/*
// @include        http://youtube.com/*
// @include        https://*.youtube.com/*
// @include        https://youtube.com/*
// @copyright      JoeSimmons
// @version        1.2.79
// @license        http://creativecommons.org/licenses/by-nc-nd/3.0/us/
// @require        http://userscripts.org/scripts/source/49700.user.js
// @require        http://userscripts.org/scripts/source/172971.user.js
//@require        http://usocheckup.dune.net/49366.js
// @grant          GM_info
// @grant          GM_getValue
// @grant          GM_log
// @grant          GM_openInTab
// @grant          GM_registerMenuCommand
// @grant          GM_setValue
// @grant          GM_xmlhttpRequest
// ==/UserScript==

/* RELEASE NOTES

1.2.79
    - Changed margins on the settings button when in footer
    - Switched JSL/pushState checking order.
        Previously in 1.2.78, if JSL didn't exist or wasn't @required, the script
        would still loop every 500ms to re-set the pushState method, even though the
        script wasn't going to be running.
        I switched that so that JSL has to exist before the script does anything.

1.2.78
    - Fixed bug where options button wasn't getting added to the footer with the new Red Bar YT feature

1.2.77
    - Adapted to the new YouTube feature that uses HTML5's history.pushState to load videos
    - Small fixes here and there
    - Excluded (with RegExp) pages without videos on them
    - Fixed GM_config.log()
    - Declared all variables at the beginning of functions
    - Made finding the video player a little more reliable
    - Make 'autoplay on playlists' work with HTML5 videos

1.2.76
    - Added new quality option ('1080p+' - for anything higher than 1080p)

1.2.75
    - Added a new option (to move option button to page footer)
    - Added a new option (to autoplay on playlists regardless of auto[play/buffer] setting)
    - Added a first time user message box
    - Fixed bug with GM_config's [set/get]Value functions. Chrome/Opera were not using localStorage before this update

1.2.74
    - Adapted to YouTube's new layout

1.2.73
    - Added compatibility for user pages

1.2.72
    - Made it fully working again in Opera & Chrome
    - Switched from setInterval to setTimeout due to instability
    - Added an anonymous function wrapper

1.2.71
    - Added compatibility for HTML5

*/



// find by JoeSimmons
String.prototype.find = function (s) {
    return this.indexOf(s) !== -1;
};

// getPref by JoeSimmons
// Syntax example: 'autoplay=1&hq=0&ads=1'.getPref('hq')
String.prototype.getPref = function (s, splitter) {
    return this.match( new RegExp('[?&]?' + s + '=([^&]*)') )[1];
};

// setPref by JoeSimmons
// Syntax example: 'autoplay=1&hq=0&ads=1'.setVar('ads', '0').setVar('vq', '1')
String.prototype.setPref = function (q, v) {
    return this.replace(new RegExp('([?&])?' + q + '=[^&]*'), '') + '&' + q + '=' + v;
};

// Run the script in an anonymous function
(function ytAutoBuffer() {

'use strict';

var URL = location.href,
    sec = 0,
    navID = 'watch7-user-header',
    list_regex = /[?&]list=/i,
    nav, pushState_orig, instead, ps_intv, wait_to;

// msg by JoeSimmons. first arg is the message, second arg is the header
function msg(t, h, center) {

    var box_id_name = 'script_msg',
        exist = JSL.id(box_id_name);

        // trim excess whitespace
        h = h.trim();
    
    if (!exist) {
        JSL.addStyle('@keyframes blink {\n\t50% {color: #B95C00;}\n}\n\n#' + box_id_name + ' .msg-header {\n\tanimation: blink 1s linear infinite normal;\n}');
        document.body.appendChild(

            // main box
            JSL.create('div', {id : box_id_name, style : 'position: fixed; z-index: 99999; top: 25%; left: 25%; width: 50%; height: 25%; padding: 50px; background-color: #E9E9E9; border: 3px double #006195;', title : 'Double-click this box to close it.', ondblclick : function () {
                JSL.hide( JSL.id(box_id_name) );
            }}, [

                // header
                JSL.create('div', {style : 'margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid #B0B0B0; color: #F07800; font-size: 18px; text-shadow: 2px 2px 4px #C7C7C7; text-align: center;', 'class' : 'msg-header', textContent : (typeof h === 'string' && h !== '' ? h : 'Message Box by JoeSimmons. Double-click to close.')}, [

                    // text (message)
                    JSL.create('div', {innerHTML : t.replace(/\n/g, '\n<br />\n'), style : (center === true ? 'width: 100%; height: 100%; text-align: center; ' : '') + 'color: #000000; font-size: 13px; font-family: sans-serif, arial; font-weight: normal; text-shadow: 0 0 8px #AEAEAE;'})
                ])
            ])
        );
    } else {
        exist.innerHTML += t.replace(/\n/g, '\n<br />\n');
    }
    
}

function unwrap(elem) {
     if ( elem && typeof XPCNativeWrapper !== 'undefined' && elem === XPCNativeWrapper(elem) ) {
        return XPCNativeWrapper.unwrap(elem);
    } else {
        return elem;
    }
}

function onYouTubePlayerReady(playerId) {
    var player = document.getElementById('movie_player'),
    startTime = player.getCurrentTime();

    window['g_YouTubePlayerIsReady'] = true;

    // Add the event listeners so functions get executed when the player state/format changes
    player.addEventListener('onStateChange', 'stateChange');
    player.addEventListener('onPlaybackQualityChange', 'onPlayerFormatChanged');

    // Play the video if autobuffer enabled, otherwise just set volume
    if (autobuffer === 'buffer') player.playVideo();
        else if (volume !== 1000) player.setVolume(volume);
}

function stateChange() {
    var player = document.getElementById('movie_player');

    switch ( player.getPlayerState() ) {
        case 1: // 1 = playing

            if (alreadyBuffered === false && autobuffer === 'buffer' && !playIfPlaylist) {

                // Pause the video so it can buffer
                player.pauseVideo();

                // Set the volume to the user's preference
                if (volume !== 1000) player.setVolume(volume);

                // Seek back to the beginning, or pre-defined starting time (url #t=xx)
                if (player.getCurrentTime() <= 3) player.seekTo(0);

                // Make sure it doesn't auto-buffer again when you press play
                alreadyBuffered = true;

            }

            break;
    }
}

// this is the main function. it does all the autobuffering, quality/volume changing, annotation hiding, etc
function main(player) {

    var playerClone = player.cloneNode(true),
        autoBuffer = GM_config.get('autoBuffer'),
        playIfPlaylist = list_regex.test(URL) && GM_config.get('autoplayplaylists') === true,
        tagName = player.tagName;

    // show the first time user message, then set it to never show again
    if (GM_config.getValue('yt-autobuffer-autohd-first', 'yes') === 'yes') {
        msg('Welcome to YouTube Auto Buffer & Auto HD. There is an options button below the video.\n\n\n' +
            'Double-click this box to close it forever.', '\'YouTube Auto Buffer & Auto HD\' Message', true);
        GM_config.setValue('yt-autobuffer-autohd-first', 'no');
    }

        if (tagName === 'VIDEO') { // the video is HTML5

            if (autoBuffer !== 'play') {
                player.pause(); // try to pause the html5 player
                if (player.currentTime <= 3) player.currentTime = 0; // try to reset the time on the html5 player
            }

        } else if (tagName === 'EMBED') { // the video is Flash

            // set the new player's flashvars 
            playerClone.setAttribute('flashvars', ( playerClone.getAttribute('flashvars')
                        .setPref('autoplay', (autoBuffer !== 'none' || playIfPlaylist ? '1' : '0') )           // enable/disable autoplay
                        .setPref('enablejsapi', '1')                                                           // enable JS API
                        .setPref('iv_load_policy', (GM_config.get('hideAnnotations') === true ? '3' : '1') )   // enable/disable annotations
                        .setPref('vq', GM_config.get('autoHD') ) )                                             // set the quality
            );
            JSL.replace(player, playerClone);

            JSL.addScript('var alreadyBuffered = false, playIfPlaylist = ' + playIfPlaylist + ', volume = ' + parseInt(GM_config.get('volume'), 10) + ', autobuffer = \'' + autoBuffer + '\';\n\n' + onYouTubePlayerReady + '\n\n' + stateChange, 'stateChange');

        }

}

function addButton() {

    // set the options button to get appended to the footer if the option is enabled
    navID = GM_config.get('footer') === true ? 'footer-main' : navID;

    // grab an element to append the options button onto
    nav = JSL.id(navID) || JSL.query('div.primary-pane, div[class="module-view featured-video-view-module"], #gh-overviewtab > div.c4-spotlight-module');

    if ( nav && !JSL.id('autobuffer-options') ) {
        nav.appendChild(
            JSL.create('button', {id: 'autobuffer-options', style: (GM_config.get('footer') === true ? 'margin-left: 10px; ' : 'margin-top: 8px; ') + 'margin-right: 8px; border: 1px solid #CCCCCC; border-radius: 6px; background: transparent !important;', 'class': 'yt-uix-button yt-uix-button-text yt-uix-tooltip', type: 'button', onclick: GM_config.open}, [
                JSL.create('span', {'class': 'yt-uix-button-content', title: 'Click here to set default AutoBuffer options'}, [
                    JSL.create('text', 'AutoBuffer Options') // add the button text
                ])
            ])
        );
    }

}

// this function sets up the script
function init() {
    // Exit if it's a page it shouldn't run on
    if (/^https?:\/\/([^\.]+\.)?youtube\.com\/(feed\/|account|inbox|my_|tags|view_all|analytics|dashboard|results)/i.test(URL)) { return; }

    // fix #t= problem in url
    if ( URL.find('#t=') ) {
        location.href = URL.replace('#t=', '&t=');
    }

    // wait for the player to be ready
    sec = 0;
    waitForReady(true);
}

// this function waits for the navbar and movie player to
// be ready before starting
function waitForReady() {

    var player = unwrap( JSL.query('#movie_player, video[class*="html5-main-video"]') ),
        tagName = player ? player.tagName : '';

    // wait for player to be loaded (check if element is not null and player api exists
    // if so, run main function and add the options button
    if ( player && ( (tagName === 'EMBED' && player.getPlayerState) || (tagName === 'VIDEO' && player.pause) ) ) {

        // add the options button
        addButton();

        // run the main function
        main(player);

    } else if (sec < 100) {
        sec += 1;
        wait_to = setTimeout(waitForReady, 100);
    }

}

// Make sure the page is not in a frame
if (window.self !== window.top) { return; }

// Make 100% sure this script is running on YouTube
if ( !/^https?:\/\/([^\.]+\.)?youtube\.com\//.test(URL) ) { return; }

// quit if JSL/GM_config is non-existant
if (typeof JSL !== 'object' || typeof GM_config !== 'object') { return; }

// handle the new YouTube feature that uses history.pushState if the browser supports it
if (typeof window.history.pushState === 'function') {
    pushState_orig = history.pushState; // keep a reference to the original pushState function
        
    instead = function instead(state, title, url) {
        if (arguments.length > 1) {
            URL = url || state || title || location.href;
            init(); // call our callback function so we know when pushState was called
            return pushState_orig.apply(history, arguments); // call the original pushState function
        } else if (arguments.length === 1) {
            URL = location.href;
            init();
        }
    };
        
    window.addEventListener('popstate', instead, false);

    // set an interval of 500ms to re-set the history.pushState method
    // clear it on page unload so that the browser closes faster
    ps_intv = setInterval(function () {
        unwrap(window).history.pushState = instead;
    }, 500);
}

window.addEventListener('unload', function (event) {
    clearInterval(ps_intv); // disallow pushState to be re-set anymore
    clearTimeout(wait_to); sec = 100; // disallow waitForReady() to run anymore
    window.removeEventListener('popstate', instead, false); // don't listen to 'onpopstate' anymore
}, false);

// add a user script command
if (typeof GM_registerMenuCommand === 'function') GM_registerMenuCommand('YouTube Auto Buffer & Auto HD Options', GM_config.open);

// init GM_config
GM_config.init('YouTube Auto Buffer & Auto HD Options', {
    autoBuffer : {
        label : 'Auto[Buffer/Play]',
        type : 'select',
        section : ['Main Options'],
        options : {
            'buffer' : 'Auto Buffer',
            'play' : 'Auto Play',
            'none' : 'No Auto[Buffer/Play]'
        },
        'default' : 'buffer'
    },
    autoHD : {
        label : 'Auto HD',
        type : 'select',
        options : {
            'small' : '240p',
            'medium' : '360p (normal)',
            'large' : '480p',
            'hd720' : '720p (HD)',
            'hd1080' : '1080p (HD)',
            'highres' : '1080p+ (anything higher)'
        },
        'default' : 'hd720'
    },
    volume : {
        label : 'Set volume to: ',
        type : 'select',
        options : {
            1000 : 'Don\'t Change',
            0 : 'Off',
            5 : '5%',
            10 : '10%',
            20 : '20%',
            25 : '25% (quarter)',
            30 : '30%',
            40 : '40%',
            50 : '50% (half)',
            60 : '60%',
            70 : '70%',
            75 : '75% (three quarters',
            80 : '80%',
            90 : '90%',
            100 : '100% (full)',
        },
        title : 'What to set the volume to',
        'default' : 1000
    },
    autoplayplaylists : {
        label : 'Autoplay on Playlists (override)',
        type : 'checkbox',
        'default' : false,
        title : 'This will enable autoplay on playlists, regardless of Auto[Buffer/Play] option'
    },
    hideAnnotations : {
        label : 'Disable Annotations',
        type : 'checkbox',
        'default' : true,
        title : 'This will make the annotations be off by default'
    },
    footer : {
        label : 'Show options button in page footer instead',
        type : 'checkbox',
        'default' : false,
        title : 'This will make the options button show at the bottom of the page in the footer'
    }
}, '#config_header {\n\tfont-size:16pt !important;\n}\n\n.config_var {\n\tmargin-left:20% !important;\n\tmargin-top: 20px !important;\n}\n\n#header {\n\tmargin-bottom:30px !important;\n}\n\n.indent40 {\n\tmargin-left:20% !important;\n}\n\n.config_var * {\n\tfont-size: 13px !important;\n}', {
    open : function () {
        var frame = GM_config.frame;
        frame.style.height = '50%';
        frame.style.width = '50%';
        GM_config.center();
    }
});

// call the function that sets up everything
init();

}());