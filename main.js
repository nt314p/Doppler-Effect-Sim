/*jshint esversion: 6 */
var canvas, ctx, audioCtx, oscillator, gainNode, prevT, prevD, paramsForm;

window.onload = () => {
    canvas = document.getElementById('mainCanvas'); // initialize canvas
    ctx = canvas.getContext('2d');

    audioCtx = new AudioContext(); // initialize audio
    oscillator = audioCtx.createOscillator();
    gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    gainNode.gain.value = 0;

    document.getElementById("paramsForm").addEventListener('submit', submitParams, false);
    document.getElementById("zoom").addEventListener('input', updateZoom, false);
    document.getElementById("volumeEmphasis").addEventListener('input', updateVolumeEmphasis, false);

    resetSim();
    oscillator.start(0);

    if (!step) window.requestAnimationFrame(draw);
};


class Point {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    distanceTo(p) {
        return Math.sqrt(Math.pow(this.x - p.x, 2) + Math.pow(this.y - p.y, 2));
    }

    magnitude() {
        return this.distanceTo(new Point(0, 0));
    }

    add(p) {
        this.x += p.x;
        this.y += p.y;
    }

    multiply(k) {
        return new Point(k * this.x, k * this.y);
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
            zoom * (this.p.x) + canvas.width / 2,
            canvas.height / 2 - zoom * this.p.y,
            zoom * this.r, 0, 2 * Math.PI);
        ctx.fill();
    }
}

var step = false;
var time = 0;

var freqS, vM, maxDecibels, observer, source, powerS, zoom, time0, vRel, volumeEmphasis;

const i0 = Math.pow(10, -12);
const dTsamples = 30; // smooting factor for timestep
var arrDT = [];
zoom = 1;
volumeEmphasis = 6;

function submitParams(event) {
    event.preventDefault();
    resetSim();
}

function resetSim() {
    prevT = performance.now();
    time0 = performance.now();

    freqS = parseInt(document.getElementById("freqS").value);
    powerS = parseInt(document.getElementById("powerS").value);

    source = new Circle(
        parseInt(document.getElementById("xS").value),
        parseInt(document.getElementById("yS").value),
        parseInt(document.getElementById("vxS").value),
        parseInt(document.getElementById("vyS").value),
        2, "red");

    observer = new Circle(
        parseInt(document.getElementById("xO").value),
        parseInt(document.getElementById("yO").value),
        parseInt(document.getElementById("vxO").value),
        parseInt(document.getElementById("vyO").value),
        2, "blue");

    vM = parseInt(document.getElementById("vM").value);
    maxDecibels = maximumDecibels();
    prevD = source.distanceTo(observer);
}


function draw() {
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    time = performance.now() - time0;
    time /= 1000; // convert to seconds

    var currT = performance.now(); // delta time
    var dT = (currT - prevT) / 1000;
    prevT = currT;

    arrDT.unshift(dT); // add current dT to front of array
    if (arrDT.length > dTsamples) arrDT.pop(); // maintain a maximum of 10 samples in dT array
    var avgDT = arrDT.reduce((total, d) => total + d, 0) / arrDT.length; // calculate average dT

    vRel = relativeVelocity(time);

    // console.log("fps: " + Math.floor(1 / avgDT));

    var sourceI = intensity(powerS, distance(time));
    var dB = intensityToDecibels(sourceI);
    var gain = dB / maxDecibels; //Math.pow(i, 4)//Math.exp(i)/Math.E;

    var fDoppler = doppler(freqS, 340, vRel);
    updateSound(fDoppler, gain);

    setStat("dist", distance(time));
    setStat("vRel", vRel);
    setStat("intensity", sourceI);
    setStat("dB", dB);
    setStat("fDoppler", fDoppler);
    setStat("fps", 1 / avgDT);

    observer.draw();
    source.draw();

    observer.move(time);
    source.move(time);

    if (!step) window.requestAnimationFrame(draw);
}

// params: f_source, v_medium (v_sound in medium), v_source (relative to observer)
// returns: f_doppler
function doppler(fS, vM, vRel) {
    var result = (vM * fS) / (vM - vRel);
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
    var top = ((dVX() * dVX() + dVY() * dVY()) * t + dotP());
    var bottom = distance(t);
    return -top / bottom;
}

function maximumDecibels() {
    // minT found by solving for d'(t) = 0 to find minimum distance
    var minT = dotP() / (dVX() * dVX() + dVY() * dVY());
    var minDist = Math.max(0.5, distance(minT)); // avoid minDist = 0
    return intensityToDecibels(intensity(powerS, minDist));
}

function updateSound(frequency, gain) {
    oscillator.frequency.value = frequency;
    setAbsoluteGain(gain);
}

function updateZoom() {
    zoom = document.getElementById("zoom").value;
    document.getElementById("zoomTxt").innerHTML = zoom;
}

function updateVolumeEmphasis() {
    volumeEmphasis = document.getElementById("volumeEmphasis").value;
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

function setStat(id, value) {
    document.getElementById(id).innerHTML = value.toFixed(2);
}

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