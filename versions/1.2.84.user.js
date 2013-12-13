// ==UserScript==
// @name           YouTube Auto Buffer & Auto HD
// @namespace      http://userscripts.org/users/23652
// @description    Buffers the video without autoplaying and puts it in HD if the option is on. For Firefox, Opera, & Chrome
// @include        http://*.youtube.com/*
// @include        http://youtube.com/*
// @include        https://*.youtube.com/*
// @include        https://youtube.com/*
// @copyright      JoeSimmons
// @version        1.2.84
// @license        http://creativecommons.org/licenses/by-nc-nd/3.0/us/
// @require        http://userscripts.org/scripts/source/49700.user.js?name=GM_config
// @require        https://raw.github.com/joesimmons/jsl/master/jsl.user.js
// @require        http://usocheckup.dune.net/49366.js
// @grant          GM_info
// @grant          GM_getValue
// @grant          GM_log
// @grant          GM_openInTab
// @grant          GM_registerMenuCommand
// @grant          GM_setValue
// @grant          GM_xmlhttpRequest
// ==/UserScript==

/* RELEASE NOTES

1.2.84 (10/31/2013)
    - added primitive type checking when copying ytplayer.config.args into the flashvars.
        this fixes the issue with Flashgot and possibly other add-ons
    - fixed non-activation by moving the _spf_state check to the top of init.
        this disables SPF on every YouTube page now, and should make the script activate correctly
    - changed all RegExp test methods to match. match seems more consistent.
        I've had cases where test doesn't work, but match does

1.2.83 (10/28/2013)
    - added auto HD, volume, and more activation modes for html5 (thanks to youtube updating its API)
    - changed the default quality to 1080p
    - changed the wording of some options
    - changed the "Disable Dash Playback" option to false for default
    - disabled SPF (aka Red Bar feature) completely until I get playlists working better
    - changed the setPref prototype function to a regular function

1.2.82 (9/5/2013)
    - added support for older Firefox versions (tested on 3.6)
    - added a new option to disable 'dash' playback (videos loading in blocks/pieces)
    - re-added ad removal feature (experimental for now)

1.2.81
    - fixed HTML5 support. YT changed tag names so the script got confused
    - made a few minor performance tweaks
    - fixed 'play symbol in title' bug in autobuffer mode (it would show playing, even though it's paused/buffering)

1.2.80
    - switched to JSL.setInterval for consistency and drift accommodation
    - visual tweaks to:
        msg().
            the rest of the page now dims while the msg box is visible
            changed the spacing of most of the elements
            changed the font sizes and the font (Arial)
            added a close button instead of requiring a double click
            made it auto-open the options screen when the msg is closed
        GM_config.
            made the background color more mellow and moved the section title near the middle

1.2.79
    - adjusted to the new play symbol in the youtube title feature
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





// run the script in an IIFE function, to hide its variables from the global scope
(function (undefined) {

    'use strict';

    var URL = location.href,
        sec = 0,
        navID = 'watch7-user-header',
        rList = /[?&]list=/i,
        script_name = 'YouTube - Auto-Buffer & Auto-HD',
        ads = [
            'supported_without_ads',
            'ad3_module',
            'adsense_video_doc_id',
            'allowed_ads',
            'baseUrl',
            'cafe_experiment_id',
            'afv_inslate_ad_tag',
            'advideo',
            'ad_device',
            'ad_channel_code_instream',
            'ad_channel_code_overlay',
            'ad_eurl',
            'ad_flags',
            'ad_host',
            'ad_host_tier',
            'ad_logging_flag',
            'ad_preroll',
            'ad_slots',
            'ad_tag',
            'ad_video_pub_id',
            'aftv',
            'afv',
            'afv_ad_tag',
            'afv_instream_max',
            'afv_ad_tag_restricted_to_instream',
            'afv_video_min_cpm',
            'prefetch_ad_live_stream'
        ],
        nav, wait_intv, uw, spfFn;

    // this function will get added to the page in a <script> tag
    function onYouTubePlayerReady() {
        var player = document.getElementById('movie_player');

        // adjust to the 'play symbol in title' feature
        document.title = document.title.replace(/^\u25B6\s*/, '');

        window.g_YouTubePlayerIsReady = true;

        // Add the event listeners so functions get executed when the player state/format changes
        player.addEventListener('onStateChange',             'stateChange');
        player.addEventListener('onPlaybackQualityChange',   'onPlayerFormatChanged');

        // Play the video if autobuffer enabled, otherwise just set volume
        if (autobuffer === 'buffer') {
            player.playVideo();
        } else if (volume !== 1000) {
            player.setVolume(volume);
        }
    }

    // this function will get added to the page in a <script> tag
    function stateChange() {
        var player = document.getElementById('movie_player');

        switch ( player.getPlayerState() ) {
            case 1: { // 1 = playing

                if (alreadyBuffered === false && autobuffer === 'buffer' && !playIfPlaylist) {

                    // Pause the video so it can buffer
                    player.pauseVideo();

                    // Set the volume to the user's preference
                    if (volume !== 1000) player.setVolume(volume);

                    // Seek back to the beginning, or pre-defined starting time (url #t=xx)
                    if (player.getCurrentTime() <= 3) player.seekTo(0);

                    window.setTimeout(function () {
                        // adjust to the 'play symbol in title' feature
                        document.title = document.title.replace(/^\u25B6\s*/, '');
                    }, 500);

                    // Make sure it doesn't auto-buffer again when you press play
                    alreadyBuffered = true;

                }

                break;
            }
        }
    }

    // msg by JoeSimmons. first arg is the message, second arg is the header
    function msg(t, h) {

        var box_id_name = 'script_msg',
            box = JSL('#' + box_id_name),
            rn = /[\r\n]/g;

        // trim excess whitespace
        h = typeof h === 'string' && h.length > 3 ? h : 'Message Box by JoeSimmons.';

        // add BR tags to line breaks
        t = t.replace(rn, '<br />\n');

        function msg_close(event) {
            event.preventDefault();

            JSL('#' + box_id_name).hide();
            GM_config.open();
        }

        if (!box.exists) {
            JSL.addStyle('@keyframes blink {\n\t50% {color: #B95C00;}\n}\n\n#' + box_id_name + ' .msg-header {\n\tanimation: blink 1s linear infinite normal;\n}');
            document.body.appendChild(
                JSL.create('div', {id : box_id_name, style : 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 999999; background-color: rgba(0, 0, 0, 0.6);'}, [
                    // main box
                    JSL.create('div', {id : box_id_name + '_box', style : 'position: absolute; top: 25%; left: 25%; width: 50%; height: 50%; padding-top: 50px; background-color: #E9E9E9; border: 3px double #006195;'}, [
                        // header
                        JSL.create('div', {style : 'margin: 0 auto; padding-bottom: 40px; color: #F07800; font-size: 21pt; font-family: Arial, Verdana, "Myriad Pro"; font-weight: normal; text-shadow: 2px 2px 4px #C7C7C7; text-align: center;', 'class' : 'msg-header', textContent : h}),

                        // text (message)
                        JSL.create('div', {innerHTML : t, style : 'text-align: center; margin: 0 auto; padding-top: 39px; border-top: 1px solid #B0B0B0; color: #000000; font-size: 11pt; font-family: Arial, Verdana, "Myriad Pro"; font-weight: normal; text-shadow: 0 0 8px #AEAEAE;'}),

                        // close button
                        JSL.create('div', {style : 'position: absolute; bottom: 20px; left: 0; width: 100%; text-align: center;'}, [
                            JSL.create('input', {id : box_id_name + '_close', type : 'button', value : 'Close Message', onclick : msg_close, style : 'margin: 0 auto; padding: 2px 20px; font-size: 11pt; font-family: Arial, Verdana, "Myriad Pro"; font-weight: normal;'})
                        ])
                    ])
                ])
            );
        } else {
            box.innerHTML += t;
        }
        
    }

    // will return true if the value is a primitive value
    function isPrimitiveType(value) {
        switch (typeof value) {
            case 'string': case 'number': case 'boolean': case 'undefined': {
                return true;
            }
            case 'object': {
                return !value;
            }
        }

        return false;
    }

    function setPref(str, values) {
        var i, value, rQuery;

        for (i = 0; value = values[i]; i += 1) {
            // (several lines for readability)
            rQuery = new RegExp('[?&]?' + value[0] + '=[^&]*');
            str = str.replace(rQuery, '') + '&' + value[0] + '=' + value[1];
            str = str.replace(/^&+|&+$/g, '');
        }

        return str;
    }

    // unwraps the element so we can use its methods freely
    function unwrap(elem) {
        if (elem) {
            if ( typeof XPCNativeWrapper === 'function' && typeof XPCNativeWrapper.unwrap === 'function' && elem === XPCNativeWrapper(elem) ) {
                return XPCNativeWrapper.unwrap(elem);
            } else if (elem.wrappedJSObject) {
                return elem.wrappedJSObject;
            }
        }

        return elem;
    }

    // grabs the un-wrapped player
    function getPlayer() {
        return unwrap( document.getElementById('movie_player') );
    }

    // this is the main function. it does all the autobuffering, quality/volume changing, annotation hiding, etc
    function main(player) {
        var playerClone = player.cloneNode(true),
            autoBuffer = GM_config.get('autoBuffer'),
            userQuality = GM_config.get('autoHD'),
            userVolume = GM_config.get('volume'),
            playIfPlaylist = URL.match(rList) != null && GM_config.get('autoplayplaylists') === true,
            fv = playerClone.getAttribute('flashvars'),
            isHTML5 = JSL('video.html5-main-video').exists,
            args, arg, val;

        if (uw.ytplayer && uw.ytplayer.config && uw.ytplayer.config.args) {
            args = uw.ytplayer.config.args;
        }

        if (isHTML5) {
            if (player.getPlaybackQuality() !== userQuality) {
                player.setPlaybackQuality(userQuality);
            }

            if (userVolume !== 1000) {
                player.setVolume(userVolume);
            }

            if (!playIfPlaylist) {
                if (autoBuffer === 'buffer') {
                    player.pauseVideo();
                } else if (autoBuffer === 'none') {
                    player.stopVideo();
                }
            }
        } else {
            // copy 'ytplayer.config.args' into the flash vars
            if (args) {
                for (arg in args) {
                    val = args[arg];
                    if ( args.hasOwnProperty(arg) && isPrimitiveType(val) ) {
                        fv = setPref(fv, [
                            [ arg, encodeURIComponent(val) ]
                        ]);
                    }
                }
            }

            // experimental ad removal feature
            if (GM_config.get('hideAds') === true) {
                JSL.each(ads, function (ad) {
                    var tmpRegex = new RegExp('[&?]?' + ad + '=[^&]*&?');
                    if ( fv.match(tmpRegex) ) {
                        fv = fv.replace(tmpRegex, '&');
                    }
                });
                fv = fv.replace(/^&|&$/g, '');
            }

            // edit the flashvars
            fv = setPref(fv, [
                ['enablejsapi', '1'],                                                            // enable JS API
                ['vq', userQuality],                                                             // set the quality
                ['autoplay', (autoBuffer !== 'none' || playIfPlaylist ? '1' : '0') ],            // enable/disable autoplay
                ['iv_load_policy', GM_config.get('hideAnnotations') === true ? '3' : '1' ],      // enable/disable annotations
                ['dash', GM_config.get('disableDash') === true ? '0' : '1' ]                     // enable/disable dash playback
            ]);

            // set the new player's flashvars
            playerClone.setAttribute('flashvars', fv);

            // and add some other necessary vars and functions to the page for auto-buffering
            JSL.addScript('var alreadyBuffered = false, ' +
                              'playIfPlaylist = ' + playIfPlaylist + ', ' +
                              'volume = ' + userVolume + ', ' +
                              'autobuffer = "'+ autoBuffer + '";\n\n' +
                           onYouTubePlayerReady + '\n\n' + stateChange,
            'stateChange');

            player.parentNode.replaceChild(playerClone, player);
        }

        // show the first time user message, then set it to never show again
        if (GM_config.getValue('yt-autobuffer-autohd-first', 'yes') === 'yes') {
            msg( ( 'Welcome to "' + script_name + '".\n\n\n\n' +
                'There is an options button below the video.\n\n\n\n' +
                'The options screen will automatically open when you close this message.' ), '"' + script_name + '" Message');
            GM_config.setValue('yt-autobuffer-autohd-first', 'no');
        }
    }

    // adds the Options button below the video
    function addButton() {
        var footer = GM_config.get('footer');

        // set the options button to get appended to the footer if the option is enabled
        navID = footer === true ? 'footer-main' : navID;

        // grab an element to append the options button onto
        nav = JSL('#' + navID + ', div.primary-pane, div[class="module-view featured-video-view-module"], #gh-overviewtab > div.c4-spotlight-module');

        if ( nav.exists && !JSL('#autobuffer-options').exists ) {
            nav.append('' +
                '<button id="autobuffer-options" type="button" class="yt-uix-button yt-uix-button-text yt-uix-tooltip" style="' + (footer === true ? 'margin-left: 10px; ' : 'margin-top: 8px; ') + 'margin-right: 8px; border: 1px solid #CCCCCC; border-radius: 6px; background: transparent !important;">' +
                    '<span class="yt-uix-button-content" title="Click here to set default Auto-Buffer options">Auto-Buffer Options</span>' +
                '</button>' +
            '');
            JSL('#autobuffer-options').addEvent('click', GM_config.open);
        }
    }

    // this function sets up the script
    function init() {
        // temporary fix to disable SPF aka the "red bar" feature
        if (uw._spf_state && uw._spf_state.config) {
            uw._spf_state.config["navigate-limit"] = 0;
        }

        // Exit if it's a page it shouldn't run on
        if ( URL.match(/^https?:\/\/([^\.]+\.)?youtube\.com\/(feed\/|account|inbox|my_|tags|view_all|analytics|dashboard|results)/i) ) { return; }

        // fix #t= problem in url
        if (URL.indexOf('#t=') !== -1) {
            location.href = URL.replace('#t=', '&t=');
        }

        // wait for the player to be ready
        sec = 0;
        wait_intv = JSL.setInterval(waitForReady, 200);
    }

    // this function waits for the movie player to be ready before starting
    function waitForReady() {
        var player, args;

        // if 10 seconds has elapsed, stop looking
        if (sec < 50) {
            sec += 1;
        } else {
            return JSL.clearInterval(wait_intv);
        }

        player = getPlayer();

        // wait for player to be loaded (check if element is not null and player api exists
        // if so, run main function and add the options button
        if (player && player.getPlayerState) {
            // make sure we don't continue with the interval
            sec = 50;
            JSL.clearInterval(wait_intv);

            if (uw.ytplayer && uw.ytplayer.config && uw.ytplayer.config.args) {
                args = uw.ytplayer.config.args;

                // remove ads
                if (GM_config.get('hideAds') === true) {
                    JSL.each(ads, function (key) { // remove each ad key from ytplayer.config.args
                        if (typeof args[key] !== 'undefined') {
                            delete args[key];
                        }
                    });
                }

                args.vq = GM_config.get('autoHD'); // set quality in ytplayer.config.args
                args.iv_load_policy = GM_config.get('hideAnnotations') === true ? '3' : '1'; // set annotations

                if (GM_config.get('disableDash') === true) {
                    args.dash = '0';
                    delete args.dashmpd;
                }

                uw.ytplayer.config.args = args;
            }

            // run the main function
            main(player);

            // add the options button
            addButton();
        }
    }

    // Make sure the page is not in a frame
    if (window.self !== window.top) { return; }

    // Make 100% sure this script is running on YouTube
    if ( !URL.match(/^https?:\/\/([^\.]+\.)?youtube\.com\//) ) { return; }

    // quit if JSL/GM_config is non-existant
    if (typeof JSL === 'undefined') {
        alert('"JoeSimmons\' Library" is missing.\n\nEither you\'re not using the correct plug-in, or @require isn\'t working.\n\nPlease review the script\'s main page to see which plug-in to use for your browser.');
        return;
    } else if (typeof GM_config === 'undefined') {
        alert('"GM_config" is missing.\n\nEither you\'re not using the correct plug-in, or @require isn\'t working.\n\nPlease review the script\'s main page to see which plug-in to use for your browser.');
        return;
    }

    // make sure unsafeWindow is proper in all browsers
    uw = unwrap(window);

    /*
    spfFn = uw._spf_state.config['navigate-processed-callback'];
    uw._spf_state.config['navigate-processed-callback'] = function () {
        location.href = location.href;
        URL = location.href;
        init();

        spfFn();
    };
    */

    // add a user script command
    if (typeof GM_registerMenuCommand === 'function') {
        GM_registerMenuCommand('"' + script_name + '" Options', GM_config.open);
    }

    // init GM_config
    GM_config.init('"' + script_name + '" Options', {
        autoBuffer : {
            label : 'Activation Mode',
            type : 'select',
            section : ['Main Options'],
            options : {
                'buffer' : 'Auto Buffer (aka Auto Pause)',
                'play' : 'Auto Play',
                'none' : 'Stop Loading Immediately'
            },
            'default' : 'buffer'
        },
        autoHD : {
            label : 'Auto HD',
            type : 'select',
            options : {
                'tiny' : '144p',
                'small' : '240p',
                'medium' : '360p (normal)',
                'large' : '480p',
                'hd720' : '720p (HD)',
                'hd1080' : '1080p (HD)',
                'highres' : '1080p+ (anything higher)'
            },
            'default' : 'hd1080'
        },
        hideAds : {
            label : 'Hide Ads (experimental)',
            type : 'checkbox',
            'default' : true,
            title : 'Experimental feature. Don\'t expect it to work, but please report when it doesn\'t'
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
            title : 'This will enable autoplay on playlists, regardless of the "Activation Mode" option'
        },
        hideAnnotations : {
            label : 'Disable Annotations',
            type : 'checkbox',
            'default' : false,
            title : 'This will turn off annotations'
        },
        disableDash : {
            label : 'Disable Dash Playback',
            type : 'checkbox',
            'default' : false,
            title : '"Dash Playback" loads the video in blocks/pieces; disrupts autobuffering. Note: 480p/1080p not available when disabled'
        },
        footer : {
            label : 'Show options button in page footer instead',
            type : 'checkbox',
            'default' : false,
            title : 'This will make the options button show at the bottom of the page in the footer'
        }
    }, 'body * { font-family: Arial, Verdana; } body { background-color: #E9E9E9; } #config_header { font-size: 16pt !important; } .config_var { margin-left:20% !important; margin-top: 20px !important; } #header { margin: 15px auto 30px auto !important; } .indent40 { margin-left:20% !important; } .config_var * { font-size: 10pt !important; } .section_header { margin-left: 20% !important; padding: 2px !important; }', {
        open : function () {
            var frame = GM_config.frame;
            frame.style.height = '50%';
            frame.style.width = '50%';
            GM_config.center();
        }
    });

    // call the function that sets up everything
    JSL.runAt('interactive', init);

}());