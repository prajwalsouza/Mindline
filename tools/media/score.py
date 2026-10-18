"""Original instrumental score and the quicker, voice-free Mindline film."""
import json
import math
import pathlib
import shutil
import subprocess
import wave

import numpy as np

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
BUILD = HERE/'build'
BUILD.mkdir(exist_ok=True)
SR = 48000
SECONDS = 60
RNG = np.random.default_rng(2426)


def score():
    """A warm electronic instrumental: soft keys, evolving pads, bass and light drums.

    Original notes and synthesis, with no recorded samples or third-party track.
    120 BPM, 30 bars, D major. The final two bars resolve to the tonic.
    """
    track = np.zeros((SR*SECONDS, 2), dtype=np.float64)

    def place(sound, start, level=1., pan=0.):
        i = int(start*SR)
        n = min(len(sound),len(track)-i)
        if n <= 0: return
        track[i:i+n,0] += sound[:n]*level*np.sqrt((1-pan)/2)
        track[i:i+n,1] += sound[:n]*level*np.sqrt((1+pan)/2)

    def note(midi, seconds, kind):
        t = np.arange(int(seconds*SR))/SR
        f = 440*2**((midi-69)/12)
        if kind == 'keys':
            sound = np.sin(2*np.pi*f*t)*np.exp(-t*2.4) + .23*np.sin(2*np.pi*f*2*t)*np.exp(-t*5) + .09*np.sin(2*np.pi*f*3*t)*np.exp(-t*8)
            envelope = np.minimum(t/.009,1)*np.minimum((seconds-t)/.18,1)
        elif kind == 'pad':
            sound = (np.sin(2*np.pi*f*t)+.45*np.sin(2*np.pi*f*1.002*t)+.22*np.sin(2*np.pi*f*2*t))/1.67
            envelope = np.minimum(t/.55,1)*np.minimum((seconds-t)/.9,1)
            sound *= .85+.15*np.sin(2*np.pi*.22*t)
        else:
            sound = np.sin(2*np.pi*f*t)+.2*np.sin(2*np.pi*f*2*t)
            envelope = np.minimum(t/.015,1)*np.exp(-t*3)*np.minimum((seconds-t)/.12,1)
        return sound*np.clip(envelope,0,1)

    chords = [(50,[62,66,69,73]), (47,[59,62,66,69]), (43,[59,62,66,69]), (45,[61,64,69,71])]
    melody = [78, None, 76, 73, 74, None, 73, 69, 71, None, 74, 78, 76, None, 73, 76]
    for bar in range(30):
        start = bar*2.
        root, pitches = chords[(bar//2)%4] if bar < 28 else chords[0]
        intensity = .6 if bar < 2 else 1. if bar < 26 else .7
        for j,pitch in enumerate(pitches):
            place(note(pitch,3.7,'pad'),start,.035*intensity,(j-1.5)*.4)
        if bar >= 2:
            for beat in [0,1,2,3]:
                place(note(root, .42,'bass'),start+beat*.5,.15*intensity)
            for k in range(8):
                pitch = pitches[[0,2,1,3,2,1,3,2][k]]+12
                place(note(pitch, .9,'keys'),start+k*.25,.055*intensity,(-.4 if k%2 else .4))
        else:
            for k,pitch in enumerate(pitches):
                place(note(pitch+12,1.3,'keys'),start+k*.45,.075,(k-1.5)*.3)
        if 4 <= bar < 28:
            for k in [0,2]:
                t=np.arange(int(.3*SR))/SR
                phase=2*np.pi*(47*t+50*.035*(1-np.exp(-t/.035)))
                kick=np.sin(phase)*np.exp(-t*17)*np.minimum(t/.004,1)
                place(kick,start+k*.5,.22*intensity)
            for k in [1,3]:
                t=np.arange(int(.13*SR))/SR
                noise=RNG.normal(0,1,len(t))
                brush=(noise-np.convolve(noise,np.ones(9)/9,mode='same'))*np.exp(-t*48)*np.minimum(t/.002,1)
                place(brush,start+k*.5,.032*intensity,.13)
            for k in range(8):
                t=np.arange(int(.055*SR))/SR
                noise=RNG.normal(0,1,len(t))
                hat=np.diff(noise,prepend=0)*np.exp(-t*85)
                place(hat,start+k*.25,.015 if k%2 else .01,(-.4 if k%2 else .4))
        if 8 <= bar < 26:
            for k in range(2):
                midi=melody[((bar-8)*2+k)%len(melody)]
                if midi is not None: place(note(midi,1.9,'keys'),start+k,.07,-.18)

    # A short stereo echo gives the keys space without hiding the beat.
    dry=track.copy()
    for delay,gain in [(.375,.17),(.75,.09)]:
        d=int(delay*SR)
        track[d:,0] += dry[:-d,1]*gain
        track[d:,1] += dry[:-d,0]*gain
    t=np.arange(len(track))/SR
    fade=np.minimum(t/1.2,1)*np.minimum((SECONDS-t)/2.8,1)
    track *= np.clip(fade,0,1)[:,None]
    track=np.tanh(track*1.25)
    track *= .79/max(np.max(np.abs(track)),.001)
    output=BUILD/'Mindline-original-instrumental.wav'
    with wave.open(str(output),'wb') as f:
        f.setnchannels(2); f.setsampwidth(2); f.setframerate(SR)
        f.writeframes((track*32767).astype('<i2').tobytes())
    print(f'Original instrumental: {output}',flush=True)
    return output


if __name__ == "__main__":
    score()
