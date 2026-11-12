import { useCallback, useEffect, useRef, useState } from 'react'

export default function usePrescriptionCamera(onPhoto) {
  const video = useRef(null)
  const stream = useRef(null)
  const sequence = useRef(0)
  const [active, setActive] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')
  const release = useCallback(() => { sequence.current++; stream.current?.getTracks().forEach((track) => track.stop()); stream.current = null; if (video.current) video.current.srcObject = null }, [])
  const attachVideo = useCallback((node) => { video.current = node }, [])
  const stop = useCallback(() => { release(); setActive(false); setStarting(false) }, [release])
  useEffect(() => release, [release])

  async function start(facingMode = 'environment') {
    stop()
    setError('')
    if (!navigator.mediaDevices?.getUserMedia) { setError('Camera access requires HTTPS or localhost. You can upload a prescription image instead.'); return }
    const request = ++sequence.current
    setStarting(true)
    try {
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facingMode } }, audio: false })
      if (request !== sequence.current) { media.getTracks().forEach((track) => track.stop()); return }
      stream.current = media
      video.current.srcObject = media
      setActive(true)
      await video.current.play()
    } catch (failure) {
      if (request !== sequence.current) return
      release()
      setActive(false)
      setError(failure.name === 'NotAllowedError' ? 'Camera permission was denied. Allow access in your browser, or upload an image.' : 'Unable to open the camera. Check that a camera is connected, or upload an image.')
    } finally { if (request === sequence.current || !stream.current) setStarting(false) }
  }

  async function capture() {
    const source = video.current
    if (!source?.videoWidth) { setError('The camera is not ready yet. Please try again.'); return }
    const canvas = document.createElement('canvas')
    const ratio = Math.min(1, 1600 / Math.max(source.videoWidth, source.videoHeight))
    canvas.width = Math.round(source.videoWidth * ratio)
    canvas.height = Math.round(source.videoHeight * ratio)
    canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', .88))
    if (!blob) { setError('Unable to capture the image. Please try again.'); return }
    onPhoto(new File([blob], `prescription-${Date.now()}.jpg`, { type: 'image/jpeg' }))
    stop()
  }
  return { attachVideo, active, starting, error, start, stop, capture }
}
