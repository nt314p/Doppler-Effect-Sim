/*jshint esversion: 6 */
var canvas, ctx, audioCtx, oscillator, gainNode, prevT, prevD;

window.onload = () => {
    canvas = document.getElementById('mainCanvas'); // initialize canvas
    ctx = canvas.getContext('2d');

    audioCtx = new AudioContext(); // initialize audio
    oscillator = audioCtx.createOscillator();
    gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    gainNode.gain.value = 0;

    // initialize derivative variables
    prevT = performance.now();
    prevD = source.distanceTo(observer);

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
}

class Circle extends Point {
    constructor(x, y, r, color) {
        super(x, y);
        this.r = r;
        this.color = color;
    }

    draw() {
        ctx.beginPath();
        ctx.fillStyle = this.color;
        ctx.arc(
            zoom * (this.x) + canvas.width / 2,
            canvas.height / 2 - zoom * this.y,
            zoom * this.r, 0, 2 * Math.PI);
        ctx.fill();
    }
}

var step = false;
var freqS = 270;

var observer = new Circle(0, 0, 2, "blue");
var source = new Circle(-200, 20, 2, "red");

var soundP = 600;
const i0 = Math.pow(10, -12);
const maxDecibels = 10 * Math.log10(intensity(soundP, source.y) / i0);
const dTsamples = 10; // smooting factor for timestep
var zoom = 6; // zoom factor around origin (zoom=2, 1m = 2px)

var arrDT = [];

console.log("max dB: " + maxDecibels);
console.log(observer);


function draw() {
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    var currT = performance.now(); // delta time
    var dT = (currT - prevT) / 1000;
    prevT = currT;

    arrDT.unshift(dT); // add current dT to front of array
    if (arrDT.length > dTsamples) arrDT.pop(); // maintain a maximum of 10 samples in dT array
    var avgDT = arrDT.reduce((total, d) => total + d, 0) / arrDT.length; // calculate average dT

    var dD = prevD - source.distanceTo(observer); // delta displacement
    var vRel = dD / avgDT; // calculating relative velocity

    //console.log("dist: " + source.distanceTo(observer));
    // console.log("dD: " + dD);
    // console.log("vRel: " + (dD / dT));

    console.log("fps: " + Math.floor(1 / avgDT));
    prevD = source.distanceTo(observer);

    var sourceI = intensity(soundP, prevD);
    var dB = 10 * Math.log10(sourceI / i0);
    var gain = dB / maxDecibels; //Math.pow(i, 4)//Math.exp(i)/Math.E;

    // console.log("intensity: " + sourceI);
    // console.log("dB: " + dB);
    // console.log("gain: " + gain);

    updateSound(doppler(freqS, 340, vRel), gain);

    observer.draw();
    source.draw();

    source.add(new Point(70 * avgDT, 0)); // moving sound source

    if (!step) window.requestAnimationFrame(draw);
}

// params: f_source, v_medium (v_sound in medium), v_source (relative to observer)
// returns: f_doppler
function doppler(fS, vM, vRel) {
    return (vM * fS) / (vM - vRel);
}

// calculates intensity of sound in W*m^-2
function intensity(soundP, dist) {
    return soundP / (4 * Math.PI * dist * dist);
}

function updateSound(frequency, gain) {
    oscillator.frequency.value = frequency;
    setAbsoluteGain(gain);
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
    gainNode.gain.value = Math.pow(gain, 7);
}


