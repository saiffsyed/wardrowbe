import { act, fireEvent, screen } from '@testing-library/react'

/** Opens the item screen's "more actions" menu, where the photo and AI actions now live. */
export function openMoreActions(label = 'moreActions') {
  const trigger = screen.getByRole('button', { name: label })
  act(() => {
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: 'mouse' })
  })
}
