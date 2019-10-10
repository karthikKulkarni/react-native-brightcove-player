import React, {Component} from 'react'
import {
    Animated,
    AppState,
    AppStateStatus,
    BackHandler,
    Dimensions,
    Platform,
    StatusBar,
    StyleSheet,
    Text,
    View,
    Button,
    TouchableOpacity
} from 'react-native'
import BrightcovePlayer from './BrightcovePlayer'
import Orientation from 'react-native-orientation'
import withEvents from './Events'
import {ControlBar} from "./ControlBar"
import {ScreenButtons} from "./screenButtons"
import {QualityOverlayButtons} from "./qualityOverlayButtons"
import {FadeInAnim, FadeOutAnim} from "react-native-brightcove-player/src/fade-anim";
import {ToggleIcon} from "react-native-brightcove-player/src/ToggleIcon";
import {QualityControl} from "react-native-brightcove-player/src/qualityControl";


// Wraps the Brightcove player with special Events
const BrightcovePlayerWithEvents = withEvents(BrightcovePlayer)

const Win = Dimensions.get('window')
const backgroundColor = '#000'

const styles = StyleSheet.create({
    background: {
        backgroundColor,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 98
    },
    fullScreen: {
        ...StyleSheet.absoluteFillObject
    },
    image: {
        ...StyleSheet.absoluteFillObject,
        width: undefined,
        height: undefined,
        zIndex: 99
    }
})

class BCPlayer extends Component {
    constructor(props) {
        super(props)
        this.state = {
            paused: false,
            fullScreen: false,
            inlineHeight: Win.width * 0.5625,
            percentageTracked: {Q1: false, Q2: false, Q3: false, Q4: false},
            mediainfo: null,
            onRotate: false,
            appState: AppState.currentState,
            muted: false,
            loading: false,
            duration: 0,
            progress: 0,
            currentTime: 0,
            seeking: false,
            renderError: false,
            qualityControlMenu: false,
            bitRate: 120000,
            showControls: true,
            showClickOverlay: false,
            seconds: 0,
            controlsOverlayClicked: false
        }
        this.animInline = new Animated.Value(Win.width * 0.5625)
        this.animFullscreen = new Animated.Value(Win.width * 0.5625)
        this.BackHandler = this.BackHandler.bind(this)
        this.orientationDidChange = this.orientationDidChange.bind(this)
        this._handleAppStateChange = this._handleAppStateChange.bind(this)
        this.onAnimEnd = this.onAnimEnd.bind(this)
    }

    componentWillMount() {
        // The getOrientation method is async. It happens sometimes that
        // you need the orientation at the moment the JS runtime starts running on device.
        // `getInitialOrientation` returns directly because its a constant set at the
        // beginning of the JS runtime.
        // Remember to remove listener
        Orientation.removeOrientationListener(this.orientationDidChange)
    }

    componentDidMount() {
        Orientation.addOrientationListener(this.orientationDidChange)
        BackHandler.addEventListener('hardwareBackPress', this.BackHandler)
        AppState.addEventListener('change', this._handleAppStateChange)
        this.setTimer()
    }

    setTimer() {
        this.timer = setInterval(() => {
            switch (true) {
                case this.state.seeking:
                    // do nothing
                    break
                case this.state.controlsOverlayClicked:
                    if (this.state.seconds > 0) this.setState({seconds: 0, controlsOverlayClicked: false})
                    break
                case this.state.showClickOverlay:
                    break
                case this.state.seconds > 3:
                    this.setState({
                        showControls: false,
                        seconds: 0
                    })
                    break
                default:
                    this.setState({seconds: this.state.seconds + 1})
            }
        }, 1000)
    }

    _handleAppStateChange(nextAppState: AppStateStatus) {
        if (
            this.state.appState.match(/inactive|background/) &&
            nextAppState === 'active') {
            if (this.state.fullScreen) {
                this.player.setFullscreen(false)
            }
        }
        this.setState({appState: nextAppState})
    }

    componentWillUnmount() {
        BackHandler.removeEventListener('hardwareBackPress', this.BackHandler)
        Orientation.removeOrientationListener(this.orientationDidChange)
        AppState.removeEventListener('change', this._handleAppStateChange)
        clearInterval(this.timer)
    }

    orientationDidChange(orientation) {
        if (this.props.rotateToFullScreen) {
            if (orientation === 'LANDSCAPE' && !this.state.fullScreen) {
                this.setState({onRotate: true}, () => {
                    this.player.setFullscreen && this.player.setFullscreen(true)
                })
                return
            }
            if (orientation === 'PORTRAIT' && this.state.fullScreen) {
                this.setState({onRotate: true}, () => {
                    this.player.setFullscreen && this.player.setFullscreen(false)
                })
                return
            }
        }
    }

    BackHandler() {
        if (this.state.fullScreen) {
            this.player.setFullscreen(false)
            return true
        }
        return false
    }

    playVideo() {
        this.player.playVideo(true)
    }

    seekToLive() {
        this.player.seekToLive()
    }

    setBitRate() {
        this.player.setBitRate(240)
    }

    toggleFS() {
        this.setState({fullScreen: !this.state.fullScreen}, () => {
            if (this.state.fullScreen) {
                const initialOrient = Orientation.getInitialOrientation()
                const height = this.state.onRotate ? Dimensions.get('window').height : Dimensions.get('window').width
                this.props.onFullScreen && this.props.onFullScreen(this.state.fullScreen)
                if (!this.state.onRotate) Orientation.lockToLandscape()
                this.animToFullscreen(height)
            } else {
                if (this.props.fullScreenOnly) {
                    this.setState({paused: true}, () => this.props.onPlay(!this.state.paused))
                }
                this.props.onFullScreen && this.props.onFullScreen(this.state.fullScreen)
                if (!this.state.onRotate) Orientation.lockToPortrait()
                this.animToInline()
                setTimeout(() => {
                    if (!this.props.lockPortraitOnFsExit) Orientation.unlockAllOrientations()
                }, 1500)
            }
            this.setState({onRotate: false})
        })
    }

    animToFullscreen(height) {
        Animated.parallel([
            Animated.timing(this.animFullscreen, {toValue: height, duration: 200}),
            Animated.timing(this.animInline, {toValue: height, duration: 200})
        ]).start()
    }

    animToInline(height) {
        const newHeight = height || this.state.inlineHeight
        Animated.parallel([
            Animated.timing(this.animFullscreen, {toValue: newHeight, duration: 100}),
            Animated.timing(this.animInline, {toValue: this.state.inlineHeight, duration: 100})
        ]).start()
    }

    setDuration(duration) {
        console.log(duration)
        this.setState({duration: duration.duration})
    }

    toggleMute() {
        this.setState({
            muted: !this.state.muted,
            controlOverlayClicked: true
        })
    }

    seek(percent) {
        const currentTime = percent * this.state.duration
        this.setState({
            seeking: true,
            currentTime,
            controlOverlayClicked: true
        })
    }

    seekTo(seconds) {
        const percent = seconds / this.state.duration
        if (seconds > this.state.duration) {
            throw new Error(`Current time (${seconds}) exceeded the duration ${this.state.duration}`)
            return false
        }
        return this.onSeekRelease(percent)
    }

    onSeekRelease(percent) {
        const seconds = percent * this.state.duration
        this.setState({progress: percent, seeking: false}, () => {
            this.player.seekTo(seconds)
        })
    }

    progress(time) {
        const {currentTime, duration} = time
        const progress = currentTime / duration
        if (!this.state.seeking) {
            this.setState({progress, currentTime}, () => {
                // this.props.onProgress(time)
            })
        }
    }

    toggleQuality(value) {
        const quality = [449000, 1199000, 2001000, -1]
        this.setState({
            qualityControlMenu: !this.state.qualityControlMenu,
            controlOverlayClicked: true,
            bitRate: quality[value]
        })
    }

    togglePlay() {
        this.setState({
            paused: !this.state.paused,
            controlOverlayClicked: true
        }, () => this.player.playVideo(this.state.paused))
    }

    forward() {
        this.setState({
            progress: (this.state.currentTime + 10) / this.state.duration, seeking: false,
            controlOverlayClicked: true
        }, () => {
            this.player.seekTo(this.state.currentTime + 10)
        })
    }

    rewind() {
        this.setState({
            progress: (this.state.currentTime - 10) / this.state.duration, seeking: false,
            controlOverlayClicked: true
        }, () => {
            this.player.seekTo(this.state.currentTime - 10)
        })
    }

    onAnimEnd() {
        this.setState({showClickOverlay: !this.state.showControls})
    }

    render() {
        const qualityContent = ['Data Saver', 'Medium', 'High', 'Auto']

        const theme = {
            title: '#ff5000',
            more: '#ff5000',
            center: '#ff5000',
            fullscreen: '#fff',
            volume: '#ff5000',
            scrubberThumb: '#ff5000',
            scrubberBar: '#ff5000',
            seconds: '#fff',
            duration: '#ff5000',
            progress: '#ff5000',
            loading: '#ff5000',
            screenButtons: '#fff',
            qualityControl: '#fff'
        }
        const {
            fullScreen,
            paused,
            muted,
            progress,
            duration,
            currentTime,
            qualityControlMenu,
            loading,
            showControls,
            showClickOverlay
        } = this.state

        const {
            style
        } = this.props
        const AnimView = showControls ? FadeInAnim : FadeOutAnim
        return (
            <View>
                <AnimView style={{zIndex: 100, position: 'absolute', width: '100%', height: '100%', backgroundColor: '#00000080'}}
                          onEnd={this.onAnimEnd}
                          onOverlayClick={() => this.setState({controlsOverlayClicked: true})}>
                    <View style={{display: 'flex', flexDirection: 'row-reverse'}}>
                        <ToggleIcon
                            onPress={() => this.toggleFS()}
                            iconOff="fullscreen"
                            iconOn="fullscreen-exit"
                            isOn={fullScreen}
                            theme={theme.fullscreen}
                        />
                        <QualityControl
                            theme={theme.qualityControl}
                            size={20}
                            toggleQuality = {() => this.toggleQuality()}
                        />
                    </View>
                    {qualityControlMenu &&
                    <QualityOverlayButtons onPress={(value) => this.toggleQuality.bind(this, value)}
                                           qualityContent={qualityContent}/>
                    }
                    <ScreenButtons togglePlay={() => this.togglePlay.bind(this)}
                                   loading={loading} paused={paused}
                                   forward={() => this.forward.bind(this)}
                                   rewind={() => this.rewind.bind(this)} theme={theme}/>

                    {<View style={{zIndex: 1000, position: 'absolute', width: '100%', bottom: 0}}>
                        <ControlBar
                            toggleFS={() => this.toggleFS()}
                            toggleMute={() => this.toggleMute()}
                            togglePlay={() => this.playVideo()}
                            muted={muted}
                            fullscreen={fullScreen}
                            onSeek={pos => this.seek(pos)}
                            onSeekRelease={pos => this.onSeekRelease(pos)}
                            progress={progress}
                            currentTime={currentTime}
                            theme={theme}
                            duration={duration.duration || duration}
                            toggleQuality={() => this.toggleQuality()}
                            seekToLive={() => this.seekToLive()}
                            fullScreen={this.state.fullScreen}
                        />
                    </View>}
                </AnimView>
                {showClickOverlay &&
                <TouchableOpacity style={{zIndex: 10000, position: 'absolute', width: '100%', height: '100%'}}
                                  onPress={() => this.setState({showControls: true})}/>}
                <Animated.View
                    style={[
                        styles.background,
                        fullScreen ?
                            (styles.fullScreen, {height: this.animFullscreen})
                            : {height: this.animInline},
                        fullScreen ? null : style
                    ]}
                >
                    <StatusBar hidden={fullScreen}/>
                    <BrightcovePlayerWithEvents
                        ref={(player) => this.player = player}
                        {...this.props}
                        style={[styles.player, this.props.style]}
                        playerId={this.props.playerId ? this.props.playerId : `com.brightcove/react-native/${Platform.OS}`}
                        onBeforeEnterFullscreen={this.toggleFS.bind(this)}
                        onBeforeExitFullscreen={this.toggleFS.bind(this)}
                        disableDefaultControl={true}
                        onChangeDuration={(duration) => this.setDuration(duration)}
                        onProgress={e => this.progress(e)}
                        volume={muted ? 0 : 10}
                        bitRate={this.state.bitRate}
                        onBufferingStarted={() => this.setState({loading: true})}
                        onBufferingCompleted={() => this.setState({loading: false})}
                    />
                </Animated.View>
            </View>
        )
    }

}

BCPlayer.defaultProps = {
    placeholder: undefined,
    style: {},
    autoPlay: false,
    inlineOnly: false,
    fullScreenOnly: false,
    rotateToFullScreen: false,
    lockPortraitOnFsExit: false,
    disableControls: false
}


module.exports = BCPlayer
