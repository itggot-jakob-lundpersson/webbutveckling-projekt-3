


			var GURKA_AV_HALFLIFE_ms = 5e3;
			var GURKA_AV_R_pms = -Math.log(2)/GURKA_AV_HALFLIFE_ms;
			var GURKA_STABILITY_cps = 4;
			var GURKA_AV_BASE_dpms = 6e-3;
			var GURKA_MIN_CLICK_DELAY_ms = 1000/12;
			var GURKA_CLICK_INC_d = 1;
			var GURKA_CLICK_INC_dpms = 8e-3;
			var GURKA_CLICK_INC_dpmsratio = Math.exp( - GURKA_AV_R_pms * 1e3/GURKA_STABILITY_cps );
			var GURKA_PING_PERIOD_MAX_ms = 5e3;
			var GURKA_PING_PERIOD_MIN_ms = 1e3;

			var GURKA_SPRING_CONST_SQRT_pms = 1e-3;
			var GURKA_SPRING_GRACE_ms = 200;
			var GURKA_MIN_AV_dpms = -0.11*360/1e3;
			var GURKA_RCLICK_DEC_dpms = 1e-3;

			var lastClickDate = new Date();
			var lastClickA_d = 0;
			var lastClickAV_dpms = GURKA_AV_BASE_dpms;
			var lastClickTurns = 0;
			var lastClickSpringTwist_d = 0;
			var gurkaAV_dpms = GURKA_AV_BASE_dpms;
			var gurkaA_d = 0;
			var gurkaTurns = 0;
			var gurkaSpringTwist_d= 0;

			var lastPingDate = new Date();
			var lastPingClickDate = new Date();
			var lastPingClickTurns = 0;
			var lastPingClicksSince = 0;
			var lastPingRClicksSince = 0;
			var numClicks = 0;
			var numRClicks = 0;

			var UIObjectVisibility = {};

			function hptIntegrate( dt_ms, av0_dpms ) {
								var av0_NBL_dpms = av0_dpms - GURKA_AV_BASE_dpms;
				var expRT = Math.exp( GURKA_AV_R_pms * dt_ms );
				var av_NBL_dpms = expRT * av0_NBL_dpms;
				av_dpms = av_NBL_dpms + GURKA_AV_BASE_dpms;
				var da_NBL_d = av0_NBL_dpms / GURKA_AV_R_pms * ( expRT - 1 );
				da_d = da_NBL_d + dt_ms * GURKA_AV_BASE_dpms;
				return [da_d, av_dpms];
			}
			function springIntegrate( dt_ms, av0_dpms, twist0_d ) {
				var da_d, av_dpms, twist_d;
								// grace period: no force applied
				if ( dt_ms <= GURKA_SPRING_GRACE_ms ) {
					da_d = av0_dpms * dt_ms;
					av_dpms = av0_dpms;
					twist_d = twist0_d + da_d;
				} else {
					var grace_da_d = av0_dpms * GURKA_SPRING_GRACE_ms;
					dt_ms -= GURKA_SPRING_GRACE_ms;
					twist0_d += grace_da_d;
					// spring function
					var phi = Math.atan( -1/GURKA_SPRING_CONST_SQRT_pms * av0_dpms / twist0_d );
					var A = twist0_d / Math.cos(phi);
					// check if all time in spring mode
					var until_spring_free_ms = 1/GURKA_SPRING_CONST_SQRT_pms * ( Math.PI/2 - phi );
					if ( until_spring_free_ms < dt_ms ) {
						twist_d = 0;
						var hptRes = hptIntegrate( dt_ms - until_spring_free_ms, -GURKA_SPRING_CONST_SQRT_pms*A );
						hpt_da_d = hptRes[0];
						da_d = grace_da_d - twist0_d + hpt_da_d;
						av_dpms = hptRes[1];
					} else {
						twist_d = A * Math.cos( GURKA_SPRING_CONST_SQRT_pms * dt_ms + phi );
						av_dpms = -GURKA_SPRING_CONST_SQRT_pms * A * Math.sin( GURKA_SPRING_CONST_SQRT_pms * dt_ms + phi );
						da_d = grace_da_d + twist_d - twist0_d;
					}
				}
				return [ da_d, av_dpms, twist_d ];
			}
			
			function updateGurka() {
				var now = new Date();
				var since_last_click_ms = ( now.getTime() - lastClickDate.getTime() );

				var since_last_click_d = 0;
				if ( lastClickSpringTwist_d < 0 || lastClickAV_dpms < 0 ) { 					var res = springIntegrate( since_last_click_ms, lastClickAV_dpms, lastClickSpringTwist_d );
					since_last_click_d = res[0];
					gurkaAV_dpms = res[1];
					gurkaSpringTwist_d = res[2];
				} else {
					var res = hptIntegrate( since_last_click_ms, lastClickAV_dpms );
					since_last_click_d = res[0];
					gurkaAV_dpms = res[1];
				}

				gurkaA_d = ( lastClickA_d + since_last_click_d ) % 360;
				var since_last_click_turns;
				if ( lastClickA_d + since_last_click_d > 0 ) {
					since_last_click_turns = Math.floor( ( lastClickA_d + since_last_click_d ) / 360 );
				} else {
					since_last_click_turns = -Math.floor( -( lastClickA_d + since_last_click_d ) / 360 );
				}
				gurkaTurns = lastClickTurns + since_last_click_turns;
				return now;
			}
			function doPing(now) {
				if ( now === undefined ) { now = new Date(); }
				var ms = now.getTime() - lastPingDate.getTime();
				var msc = now.getTime() - lastPingClickDate.getTime();
				var turnsSince = gurkaTurns - lastPingClickTurns;
				$.getJSON( "/turn.php?v=3&ms="+ms+"&msc="+msc+"&c="+lastPingClicksSince+"&t="+turnsSince+"&cc="+numClicks+"&tt="+gurkaTurns+"&a="+gurkaA_d+"&av="+gurkaAV_dpms+"&rcc="+numRClicks);
				if ( lastPingClicksSince > 0 ) {
					lastPingClickDate = now;
					lastPingClickTurns = gurkaTurns;
				}
				lastPingClicksSince = 0;
				lastPingDate = now;
			}
			function updateUI() {
				$("#gurka").rotate({
					angle:gurkaA_d,
					center: ["50%","50%"]
				});
				// num turns
				updateUIObjectVisibility( 'turns', gurkaTurns, gurkaTurns > 0, false );
				// TPS
				AV_tps = gurkaAV_dpms/360*1000;
				updateUIObjectVisibility( 'tps', AV_tps.toFixed(2), AV_tps > 10, AV_tps < 0.5 );
				// twist
				updateUIObjectVisibility( 'twist', (-gurkaSpringTwist_d/360).toFixed(1), gurkaSpringTwist_d < -2*360, gurkaSpringTwist_d >= 0 );
				// wrong dir
				updateUIObjectVisibility( 'dir', undefined, AV_tps < -0.1, AV_tps >= 0 );
			}
			function updateUIObjectVisibility( name, value, showIfHidden, hideIfShown ) {
				if ( ! ( name in UIObjectVisibility ) )  {
					UIObjectVisibility[name] = 0;
				}
				var UIobj = $("#ui_"+name);
				if ( value !== undefined ) {
					UIobj.text( value );
				}
				if ( showIfHidden && UIObjectVisibility[name] == 0 ) {
					UIObjectVisibility[name] = 2;
					UIobj.fadeIn(2000, function(){
						UIObjectVisibility[name] = 1;
					});
				} else if ( hideIfShown && UIObjectVisibility[name] == 1 ) {
					UIObjectVisibility[name] = 2;
					UIobj.fadeOut(2000, function(){
						UIObjectVisibility[name] = 0;
					});
				}
			}
			function gurkklick(right) {
				var now = updateGurka();
				if ( now.getTime() - lastClickDate.getTime() < GURKA_MIN_CLICK_DELAY_ms ) {
					return;
				}
				lastClickDate = now;
				lastClickTurns = gurkaTurns;
				lastClickSpringTwist_d = gurkaSpringTwist_d;
				if ( ! right ) {
					lastClickA_d = gurkaA_d + GURKA_CLICK_INC_d;
					lastClickAV_dpms = gurkaAV_dpms + GURKA_CLICK_INC_dpms;
					lastClickAV_dpms *= GURKA_CLICK_INC_dpmsratio;
					lastPingClicksSince++;
					numClicks++;
				} else {
					lastClickA_d = gurkaA_d;
					lastClickAV_dpms = Math.max( gurkaAV_dpms - GURKA_RCLICK_DEC_dpms, GURKA_MIN_AV_dpms );
					lastPingRClicksSince++;
					numRClicks++;
				}
				updateGurka();
				updateUI();
				return false;
			}
			$( document ).ready(function() {
				setInterval(function(){
					var now = updateGurka();
					updateUI();
					var since_ping_ms = now.getTime() - lastPingDate.getTime();
					if ( ( lastPingClicksSince > 0 && since_ping_ms >= GURKA_PING_PERIOD_MIN_ms ) || since_ping_ms >= GURKA_PING_PERIOD_MAX_ms ) {
						doPing(now);
					}
				},40);
				$("#gurka").click(function(){ return gurkklick(0); });
				$("#gurka").contextmenu(function(){ return gurkklick(1); });
			});
		