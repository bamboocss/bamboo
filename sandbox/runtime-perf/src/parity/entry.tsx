import { createRoot } from 'react-dom/client'
import '../index.css'
import { Tree } from './tree'

/**
 * Deterministic entry for the browser parity check. The app's own `App` randomises its
 * buttons, which would make two builds incomparable.
 */
createRoot(document.getElementById('root')!).render(
  <Tree tone="red600" rest={{ title: 'spread title' }} flag={window.location.hash !== '#off'} />,
)
