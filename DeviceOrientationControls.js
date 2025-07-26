import * as THREE from 'three';

/**
 * @author richt / http://richt.me
 * @author WestLangley / http://github.com/WestLangley
 *
 * W3C Device Orientation control (http://w3c.github.io/deviceorientation/spec-source-orientation.html)
 */

class DeviceOrientationControls extends THREE.EventDispatcher {

    constructor( object ) {

        super();

        if ( window.isSecureContext === false ) {

            console.error( 'THREE.DeviceOrientationControls: DeviceOrientationEvent is only available in secure contexts (https)' );

        }

        const scope = this;

        const EPS = 0.000001;
        const lastQuaternion = new THREE.Quaternion();

        this.object = object;
        this.object.rotation.reorder( 'YXZ' );

        this.enabled = true;

        this.deviceOrientation = {};
        this.screenOrientation = 0;

        this.alphaOffset = 0; // radians

        const onDeviceOrientationChangeEvent = function ( event ) {

            scope.deviceOrientation = event;

        };

        const onScreenOrientationChangeEvent = function () {

            scope.screenOrientation = window.orientation || 0;

        };

        // The angles alpha, beta and gamma form a set of intrinsic Tait-Bryan angles of type Z-X'-Y''

        const setObjectQuaternion = function () {

            const zee = new THREE.Vector3( 0, 0, 1 );

            const euler = new THREE.Euler();

            const q0 = new THREE.Quaternion();

            const q1 = new THREE.Quaternion( - Math.sqrt( 0.5 ), 0, 0, Math.sqrt( 0.5 ) ); // - PI/2 around the x-axis

            return function ( quaternion, alpha, beta, gamma, orient ) {

                euler.set( beta, alpha, - gamma, 'YXZ' ); // 'ZXY' for the device, but 'YXZ' for us

                quaternion.setFromEuler( euler ); // orient the device

                quaternion.multiply( q1 ); // camera looks out the back of the device, not the top

                quaternion.multiply( q0.setFromAxisAngle( zee, - orient ) ); // adjust for screen orientation

            };

        }();

        this.connect = function () {

            onScreenOrientationChangeEvent(); // run once on load

            // iOS 13+

            if ( window.DeviceOrientationEvent !== undefined &&
                typeof window.DeviceOrientationEvent.requestPermission === 'function' ) {

                window.DeviceOrientationEvent.requestPermission()
                    .then( function ( response ) {

                        if ( response == 'granted' ) {

                            window.addEventListener( 'orientationchange', onScreenOrientationChangeEvent );
                            window.addEventListener( 'deviceorientation', onDeviceOrientationChangeEvent );

                        }

                    } )
                    .catch( function ( error ) {

                        console.error( 'THREE.DeviceOrientationControls: Unable to use DeviceOrientation API:', error );

                    } );

            } else {

                window.addEventListener( 'orientationchange', onScreenOrientationChangeEvent );
                window.addEventListener( 'deviceorientation', onDeviceOrientationChangeEvent );

            }

            scope.enabled = true;

        };

        this.disconnect = function () {

            window.removeEventListener( 'orientationchange', onScreenOrientationChangeEvent );
            window.removeEventListener( 'deviceorientation', onDeviceOrientationChangeEvent );

            scope.enabled = false;

        };

        this.update = function () {

            if ( scope.enabled === false ) return;

            const device = scope.deviceOrientation;

            if ( device ) {

                let alpha = device.alpha ? THREE.MathUtils.degToRad( device.alpha ) + this.alphaOffset : 0; // Z

                let beta = device.beta ? THREE.MathUtils.degToRad( device.beta ) : 0; // X'

                let gamma = device.gamma ? THREE.MathUtils.degToRad( device.gamma ) : 0; // Y''

                let orient = scope.screenOrientation ? THREE.MathUtils.degToRad( scope.screenOrientation ) : 0; // O

                setObjectQuaternion( scope.object.quaternion, alpha, beta, gamma, orient );

                if ( 8 * ( 1 - lastQuaternion.dot( scope.object.quaternion ) ) > EPS ) {

                    lastQuaternion.copy( scope.object.quaternion );
                    scope.dispatchEvent( { type: 'change' } );

                }

            }

        };

        this.dispose = function () {

            this.disconnect();

        };

        this.connect();

    }

}

export { DeviceOrientationControls };