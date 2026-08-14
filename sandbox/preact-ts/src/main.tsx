import { render } from 'preact'
import { App } from './app'
import 'virtual:bamboo.css'

render(<App />, document.getElementById('app') as HTMLElement)
