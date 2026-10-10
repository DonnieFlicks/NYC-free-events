// Each event source is a module with a NAME and a fetch() that returns events built by makeEvent.
//
// Listed in priority order: when the same event appears in two sources, the earlier one wins.
import brooklynBridgePark from './brooklynBridgePark.js'
import nycParks from './nycParks.js'
import nycPermits from './nycPermits.js'
import type { Source } from '../types.js'

export const SOURCES: Source[] = [nycParks, brooklynBridgePark, nycPermits]
