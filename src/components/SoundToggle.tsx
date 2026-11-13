import { useSyncExternalStore } from 'react'
import { isSoundEnabled, playMoveSound, setSoundEnabled, subscribeSound } from '../lib/sound'

/** Header button to turn move sounds on or off (remembered in this browser). */
export function SoundToggle() {
  const on = useSyncExternalStore(subscribeSound, isSoundEnabled)
  return (
    <button
      className="sound-toggle"
      onClick={() => {
        setSoundEnabled(!on)
        if (!on) playMoveSound('move')
      }}
      title={on ? 'Couper le son' : 'Activer le son'}
      aria-label={on ? 'Couper le son' : 'Activer le son'}
      data-testid="sound-toggle"
    >
      {on ? '🔊' : '🔇'}
    </button>
  )
}
