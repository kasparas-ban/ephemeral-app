I’m making a web app that works like this at the moment:  When the user opens the app, in the middle of the screen there’s a blinking cursor. A user starts typing and animated text appears. The text he/she types appears to float and disappears (blurs out) after some time.  The app may represent a stream of consciousness - blurry thoughts appearing out of nowhere and disappearing into the same place.

So this is the state of the app right now. Here’s where I want It to go:
“””
2D live canvas for many minds

- What it is: A shared, real-time, spatial chat where thoughts appear as floating text Move through the canvas to find clusters; proximity enables chat.
- UX flow
  - You pan/zoom to wander; hover to preview; step closer to open a live chat.
- Social mechanics
  - Ephemeral by default (text fade).
- MVP
  - 20–50 concurrent users, text-only, proximity chat
