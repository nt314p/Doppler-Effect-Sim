# Doppler Effect Simulator

This simulator can be used to both calculate and visualize the doppler effect. Try it out now [here](https://nt314p.github.io/doppler-effect-sim/index.html)!

The simulation parameter inputs are quite self explanatory and the options on the toolbar enable the user to have full control over timing and visual aspects of the simulator.

All inputs are well sanitized; however, I will warn you against using absurdly large values as you will likely receive an unpleasant high-pitched squeal from your computer.

Statistics from the observer's point of view can be read out on the bottom right. And if three decimal places aren't enough for you, hover over the value in question to receive its value in all of its 64-bit floating point glory.

Breaking the sound barrier (and the simulation) - a note:

Because the doppler shift formula does not account for faster than sound travel, my simulation can't either.
This causes some interesting frequencies (negatives anybody?), which aren't accurate.
However, the wave visuals are correct.

A challenge: What parameters make the best race car "passing you fast" noise?

Here are mine:

Source Frequency: 260

Source Power: 600

Source Position: -100, 0

Source Velocity: 70, 0

Observer Position: 0, 8

Observer Velocity: 0, 0

Speed of Sound: 340.3
