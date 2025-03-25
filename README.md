## Why

I used https://thesukha.co, which used to be called Centered, for managing my time and todos. The particular combination of music, pomodoro, and todos with time estimates definitely helped me to focus. However, I didn't need the social features and the software seemed simple enough not to justify paying a subscription. So I made this. It is a little rough around the edges, but it seems to work.

## Music

Keep a directory of music that you like and want to listen to while you work. Upload the directory and you're ready to go. Starting a session will shuffle and play your music. I didn't need or want any more fiddling around than that.

## Dev

```
npm run dev
```

```
npm run build
```

If you want to provide some other voices for telling you to take a break or get back to work, you can use https://www.tryparrotai.com/ai-voice-generator/ to generate some audio with a celebrity voice.

### Dependencies

The only dependency in this project is a build dependency (`esbuild`) for stripping the typescript types. There are no runtime dependencies which are not statically included in the repo.

These static dependencies include a modified version of:

- https://github.com/luwes/little-vdom/blob/main/little-vdom.js
  - For rendering (`vdom.ts`)
- https://github.com/rocicorp/fractional-indexing/blob/main/src/index.js
  - For fractional indexing (`fridx.ts`)

I wanted to experiment with few to no dependencies and a very simple build. I couldn't give up TypeScript, hence the use of `esbuild`. But everything else had to go. One consequence of this is less help from AI assistants due to the fact that the current generation of LLMs are not very capable once you start using niche approaches like `little-vdom`.

### Sync Between Tabs

A significant amount of code is devoted to syncing state between tabs. I judged this necessary because I want to set my home tab to this web page, which means I will probably end up with multiple tabs open to this page as I open new tabs and forget to close them. This sync is a little bit janky but seems to do the job. Mostly, the approach involves a leader tab writing data to IndexedDb or localStorage and the broadcasting the kind of change so that other tabs can read from the appropriate source and redraw the ui. The leader is also responsible for playing audio.

### Code

The codes a bit rough around the edges and is doing some non-standard things, but there isn't much of it. So it shouldn't be hard to figure out.

## Forking

Feel free to fork and adapt to your needs!

## TODO

- [ ] collect session stats
- [ ] view session stats
