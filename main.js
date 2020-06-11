/*jshint esversion: 6 */
var canvas, ctx, audioCtx, oscillator, gainNode, prevT, paramsForm;

const i0 = Math.pow(10, -12);
const DELTA_TIME_SAMPLES = 20; // smooting factor for framerate
const WAVE_MULTIPLIER_CONVERSION = [1, 2, 4, 10, 20, 40, 100, 200, 400, 1000];
const MAX_ALLOC_WAVES = 100000; // hundred thousand waves

window.onload = () => {
    canvas = document.getElementById('mainCanvas'); // initialize canvas
    ctx = canvas.getContext('2d');

    audioCtx = new AudioContext(); // initialize audio
    oscillator = audioCtx.createOscillator();
    gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    gainNode.gain.value = 0;

    // initialize option inputs
    initializeEvent("paramsForm", "submit", submitParams);
    initializeEvent("zoom", "input", updateZoom);
    initializeEvent("volumeEmphasis", "input", updateVolumeEmphasis);
    initializeEvent("waveMultiplier", "input", updateWaveMultiplier);
    initializeEvent("cameraMode", "input", updateCameraMode);
    initializeEvent("toggleTimeBtn", "click", toggleTime);
    initializeEvent("setTimeBtn", "click", setCustTime);
    initializeEvent("stepTimeBtn", "click", stepTime);

    resetSim();
    oscillator.start(0);
    window.requestAnimationFrame(draw);
};


class Point {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    distanceTo(p) {
        return Math.sqrt(Math.pow(this.x - p.x, 2) + Math.pow(this.y - p.y, 2));
    }

    transform() { // transforms point based on canvas, zoom, and global offset
        return new Point(
            zoom * (this.x - globalOffset.x) + canvas.width / 2,
            canvas.height / 2 - zoom * (this.y - globalOffset.y
            )
        );
    }
}

class Circle extends Point {
    constructor(x, y, vX, vY, r, color) {
        super(x, y);
        this.p = new Point(this.x, this.y);
        this.v = new Point(vX, vY);
        this.r = r;
        this.color = color;
    }

    move(t) {
        this.p.x = this.x + this.v.x * t;
        this.p.y = this.y + this.v.y * t;
    }

    draw() {
        ctx.beginPath();
        ctx.fillStyle = this.color;
        ctx.arc(
            this.p.transform().x,
            this.p.transform().y,
            zoom * this.r, 0, 2 * Math.PI);
        ctx.fill();
    }
}

class Wave extends Point {
    constructor(n) {
        super(0, 0);
        this.n = n;
        this.move(this.n);
    }

    move(n) {
        this.x = source.x + source.v.x * this.getTimeShift(n);
        this.y = source.y + source.v.y * this.getTimeShift(n);
    }

    getTimeShift(n) {
        return n * (1 / freqS) * (1 / waveMultiplier);
    }

    draw(t) {
        ctx.beginPath();
        ctx.arc(
            this.transform().x,
            this.transform().y,
            (t - this.getTimeShift(this.n)) * vM * zoom, 0, 2 * Math.PI);
        ctx.stroke();
    }

    isAlive(t) { // should this wave exist given the current time
        return this.getTimeShift(this.n) <= t;
    }
}

var freqS, vM, maxDecibels, observer, source, powerS, zoom, time0, time, vRel, volumeEmphasis, waveMultiplier;
var step = false; // is the simulation running, or in step mode (paused)
var arrDT = []; // array for fps calculation
var waves = [];
var globalOffset = new Point(0, 0); // global offset enables changing camera mode
zoom = 1;
volumeEmphasis = 6;
waveMultiplier = 1; // by what factor to reduce waves by (1 is full frequency)

function resetSim() {
    prevT = performance.now();
    time0 = performance.now();
    time = 0;

    freqS = getValue("freqS");
    powerS = getValue("powerS");

    source = new Circle(
        getValue("xS"),
        getValue("yS"),
        getValue("vxS"),
        getValue("vyS"),
        2, "red");

    observer = new Circle(
        getValue("xO"),
        getValue("yO"),
        getValue("vxO"),
        getValue("vyO"),
        2, "blue");

    vM = getValue("vM");
    maxDecibels = maximumDecibels();
    prevD = source.distanceTo(observer);

    updateVolumeEmphasis();
    updateWaveMultiplier();
    updateCameraMode();

    waves = [];
    for (var i = 0; i < MAX_ALLOC_WAVES; ++i) { // populate array with Wave objects
        waves.push(new Wave(i));
    }
}


function draw() {
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height); // clear canvas

    if (!step) { // only update time when running simulation
        time = performance.now() - time0;
        time /= 1000; // convert to seconds
    }

    let currT = performance.now(); // delta time for fps calculation
    let dT = (currT - prevT) / 1000;
    prevT = currT;

    arrDT.unshift(dT); // add current dT to front of array
    if (arrDT.length > DELTA_TIME_SAMPLES) arrDT.pop(); // maintain a maximum of desired samples in dT array
    var avgDT = arrDT.reduce((total, d) => total + d, 0) / arrDT.length; // calculate average dT

    vRel = relativeVelocity(time);

    let sourceI = intensity(powerS, distance(time));
    let dB = intensityToDecibels(sourceI);
    let gain = dB / maxDecibels; // gain is calculated as a ratio of dB values

    let fDoppler = doppler(freqS, vM, vRel);
    updateSound(fDoppler, gain);

    for (var i = 0; i < waves.length; ++i) {
        if (waves[i].isAlive(time)) {
            waves[i].draw(time);
        } else {
            break;
        }
    }

    observer.draw();
    source.draw();

    observer.move(time);
    source.move(time);

    setValue("dist", distance(time)); // set statistic readouts
    setValue("vRel", vRel);
    setValue("intensity", sourceI);
    setValue("dB", dB);
    setValue("fDoppler", fDoppler);
    setValue("fps", 1 / avgDT, 0, false);
    setValue("time", time);

    window.requestAnimationFrame(draw);
}

// params: f_source, v_medium (v_sound in medium), v_source (relative to observer)
// returns: f_doppler
function doppler(fS, vM, vRel) {
    let result = (vM * fS) / (vM - vRel);
    return isNaN(result) ? 0 : result;
}

// calculates intensity of sound in W*m^-2
function intensity(soundP, dist) {
    return soundP / (4 * Math.PI * dist * dist);
}

function intensityToDecibels(intensity) {
    return 10 * Math.log10(intensity / i0);
}

function distance(t) { // returns distance at certain time
    return Math.sqrt(Math.pow(dPX() + dVX() * t, 2) + Math.pow(dPY() + dVY() * t, 2));
}

function relativeVelocity(t) {
    // relative velocity is just the derivative of distance
    let top = ((dVX() * dVX() + dVY() * dVY()) * t + dotP());
    let bottom = distance(t);
    return bottom == 0 ? 0 : -top / bottom;
}

function maximumDecibels() {
    // minT found by solving for d'(t) = 0 to find minimum distance
    let minT = dotP() / (dVX() * dVX() + dVY() * dVY());
    let minDist = Math.max(0.1, distance(minT)); // avoid minDist = 0
    return intensityToDecibels(intensity(powerS, minDist));
}

function submitParams(event) {
    event.preventDefault(); // stop page from refreshing
    resetSim();
}

function updateSound(frequency, gain) {
    oscillator.frequency.value = frequency;
    setAbsoluteGain(gain);
}

function updateZoom() {
    zoom = getValue("zoom");
    document.getElementById("zoomTxt").innerHTML = zoom;
}

function updateVolumeEmphasis() {
    volumeEmphasis = getValue("volumeEmphasis");
}

function updateWaveMultiplier() {
    let denominator = WAVE_MULTIPLIER_CONVERSION[getValue("waveMultiplier")];
    waveMultiplier = 1 / denominator;
    document.getElementById("waveMultTxt").innerHTML = denominator == 1 ? 1 : "1/" + denominator;
    waves.forEach(w => w.move(w.n));
}

function updateCameraMode() {
    let offsetArr = [{ p: new Point(0, 0) }, source, observer];
    globalOffset = offsetArr[document.getElementById("cameraMode").value].p;
}

function toggleTime() {
    let button = document.getElementById("toggleTimeBtn");
    step = button.value === "⏸"; // currently paused
    if (!step) setTime(time);
    button.value = (button.value === "⏸") ? "⏵︎" : "⏸";
}

function setCustTime() {
    setTime(getValue("setTime"));
}

function stepTime() {
    setTime(time + getValue("stepTime"));
}

function setTime(newTime) {
    if (isNaN(newTime)) return;
    if (step)
        time = newTime;
    else
        time0 = performance.now() - newTime * 1000;
}

function initializeEvent(id, type, func) {
    document.getElementById(id).addEventListener(type, func, false);
}

function setValue(id, value, decimals, tooltip) {
    if (typeof decimals === "undefined") decimals = 3; // default
    // third parameter also determines whether the tooltip will be updated
    if ("undefinedboolean".indexOf(typeof tooltip) != -1 || tooltip === true)
        document.getElementById(id).title = value;
    document.getElementById(id).innerHTML = value.toFixed(decimals);
}

function getValue(id) {
    return parseFloat(document.getElementById(id).value);
}

/*
This function takes in a linear value from 0 to 1, and converts it
into an appropriate 0 to 1 on a logarithmic scale.

This is because human perception of loudness is logarithmic, and the 
gain value for this sound generator is linear.

https://www.dr-lex.be/info-stuff/volumecontrols.html for more info.

Because of the small volume range of speakers, this is quite hard to
accomplish accurately, so the model uses a high exponent in order to
accentuate the change in volume when the sound source is near to the 
observer.
*/

function setAbsoluteGain(gain) {
    if (isNaN(gain)) return;
    gainNode.gain.value = Math.pow(gain, volumeEmphasis);
}

function dotP() {
    return dPX() * dVX() + dPY() * dVY();
}

function dPX() { // delta position x
    return source.x - observer.x;
}

function dPY() { // delta position y
    return source.y - observer.y;
}

function dVX() { // delta velocity x
    return source.v.x - observer.v.x;
}

function dVY() { // delta velocity y
    return source.v.y - observer.v.y;
}