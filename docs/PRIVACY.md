# Privacy

## What is stored

One key in your browser's `localStorage`: `eve.profile.v1`. It holds the profile you
entered — state, income, filing status, children, and any optional housing, debt and
transport figures.

## What leaves your device

Nothing from your profile. Ever.

The application makes exactly two kinds of network request:

1. Its own static bundle and the `grid.json` data file, from the host serving the site
2. The webfont stylesheet from Google Fonts

Neither carries profile data. There is no analytics, no telemetry, no error reporting
service, and no third-party script beyond the font stylesheet.

## Specific commitments

- **Nothing in the URL.** Routing is hash-based and the hash contains only a page name
  and, at most, a policy identifier. No profile field is ever placed in a URL, query
  string or fragment, so nothing about your finances can leak through a referrer header,
  a shared link, or a browser history sync.
- **No account.** There is nothing to sign up for and no server-side record to breach.
- **No cookies.**
- **The calculation is local.** Your figures are produced by interpolating a static file
  already on your device. No request is made when you change your income.

## Removing your data

The "Delete it" control at the bottom of the page clears the key. Clearing site data in
your browser has the same effect. Because nothing was ever transmitted, there is nothing
else to delete anywhere.

## If you self-host

If you fork this and add analytics, a backend, or a saved-profile feature, the guarantees
above stop being true. Update this document if you do — leaving it in place while
shipping something else is worse than not having it.

## Removing the font dependency

If you want the site to make zero third-party requests, self-host the fonts and remove
the `fonts.googleapis.com` link from `index.html`. Nothing else changes.
