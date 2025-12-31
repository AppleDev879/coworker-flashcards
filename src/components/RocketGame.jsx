import { useEffect, useRef, useState } from 'react'

// Game balance constants
const GAME = {
  // Gameplay
  GRAVITY_RATE: 8,          // % altitude lost per second
  BASE_BOOST: 20,           // Base boost amount at low altitude
  BOOST_MULTIPLIER_MAX: 2.5, // Boost multiplier at 0% altitude
  BOOST_MULTIPLIER_MIN: 1.0, // Boost multiplier at 100% altitude
  DANGER_THRESHOLD: 30,     // Altitude % below which danger warning shows
  STARTING_ALTITUDE: 50,    // Starting altitude %

  // Animation
  STAR_COUNT: 60,
  LERP_SPEED_UP: 8,         // Speed for upward visual smoothing
  LERP_SPEED_DOWN: 12,      // Speed for downward visual smoothing
  DEBUG_LOG_INTERVAL: 60,   // Frames between debug logs

  // World rendering
  GROUND_LEVEL: 20,         // World Y offset for ground
  ATMOSPHERE_END: 80,       // World Y offset where atmosphere ends

  // Canvas dimensions
  CANVAS_WIDTH: 320,
  CANVAS_HEIGHT: 360,
}

// Pixel art rocket (6 wide x 8 tall, scaled up)
const ROCKET_PIXELS = [
  '  ##  ',
  ' #### ',
  ' #### ',
  ' #### ',
  '######',
  '######',
  ' #  # ',
  ' #  # ',
]

const FLAME_PIXELS = [
  ' #  # ',
  '  ##  ',
  '  ##  ',
  '   #  ',
]

const EXPLOSION_PIXELS = [
  '  # #  ',
  ' #####',
  '### ###',
  ' ##### ',
  '### ###',
  ' #####',
  '  # #  ',
]

export default function RocketGame({
  rocketHeight, // Target height from boosts/drops (only changes on correct/incorrect)
  boosting,
  crashed,
  coworkerPhoto,
  onCrash, // Callback when crashed
  gravityActive, // Whether gravity should be applied
}) {
  const canvasRef = useRef(null)
  const [stars, setStars] = useState([])
  const [photoImage, setPhotoImage] = useState(null)
  const animationRef = useRef(null)
  const frameCountRef = useRef(0)
  const lastTimeRef = useRef(0)
  const currentHeightRef = useRef(rocketHeight) // Actual height (with gravity/boosts applied)
  const visualHeightRef = useRef(rocketHeight) // Smoothly animated display height
  const lastBoostingRef = useRef(false) // Track boosting state to detect new boosts

  // Use ref for callback to avoid restarting animation
  const onCrashRef = useRef(onCrash)
  useEffect(() => { onCrashRef.current = onCrash }, [onCrash])

  // Generate stars on mount - spread across entire canvas
  useEffect(() => {
    const newStars = []
    for (let i = 0; i < GAME.STAR_COUNT; i++) {
      newStars.push({
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() > 0.7 ? 2 : 1,
        twinkle: Math.random() * Math.PI * 2,
      })
    }
    setStars(newStars)
  }, [])

  // Reset height when restarting game
  useEffect(() => {
    if (rocketHeight === GAME.STARTING_ALTITUDE && currentHeightRef.current < 10) {
      currentHeightRef.current = GAME.STARTING_ALTITUDE
      visualHeightRef.current = GAME.STARTING_ALTITUDE
    }
  }, [rocketHeight])

  // Load coworker photo as image
  useEffect(() => {
    if (!coworkerPhoto) {
      setPhotoImage(null)
      return
    }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => setPhotoImage(img)
    img.src = coworkerPhoto
  }, [coworkerPhoto])

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    const width = canvas.width
    const height = canvas.height

    // Reset timing on animation start
    lastTimeRef.current = performance.now()
    let lastTime = performance.now()

    const render = () => {
      const now = performance.now()
      let deltaTime = (now - lastTime) / 1000 // Convert to seconds
      lastTime = now

      // Clamp deltaTime to avoid huge jumps (e.g., tab was inactive)
      if (deltaTime > 0.1) deltaTime = 0.016 // Cap at ~60fps frame time

      frameCountRef.current++
      const frameCount = frameCountRef.current

      // Debug logging every N frames (~1 second at 60fps)
      if (frameCount % GAME.DEBUG_LOG_INTERVAL === 0) {
        console.log('RocketGame state:', {
          gravityActive,
          crashed,
          rocketHeight,
          currentHeight: currentHeightRef.current,
          deltaTime
        })
      }

      // Apply continuous gravity
      if (gravityActive && !crashed) {
        currentHeightRef.current -= GAME.GRAVITY_RATE * deltaTime
        if (frameCount % GAME.DEBUG_LOG_INTERVAL === 0) {
          console.log('Gravity applied, new height:', currentHeightRef.current)
        }
        if (currentHeightRef.current <= 0) {
          currentHeightRef.current = 0
          console.log('CRASH!')
          if (onCrashRef.current) onCrashRef.current()
        }
      }

      // Log boosting state changes
      if (boosting !== lastBoostingRef.current) {
        console.log('Boosting changed:', lastBoostingRef.current, '->', boosting, 'at height:', Math.round(currentHeightRef.current))
      }

      // Detect new boost (when boosting prop transitions from false to true)
      if (boosting && !lastBoostingRef.current) {
        // Boost scales by altitude - stronger at low altitude
        const boostMultiplier = GAME.BOOST_MULTIPLIER_MAX - (currentHeightRef.current / 100) * (GAME.BOOST_MULTIPLIER_MAX - GAME.BOOST_MULTIPLIER_MIN)
        const boostAmount = GAME.BASE_BOOST * boostMultiplier
        const prevHeight = currentHeightRef.current
        currentHeightRef.current = Math.min(100, currentHeightRef.current + boostAmount)
        console.log('BOOST! +' + Math.round(boostAmount) + ' (x' + boostMultiplier.toFixed(1) + '), current was:', Math.round(prevHeight), ', now:', Math.round(currentHeightRef.current))
      }
      lastBoostingRef.current = boosting

      // Smoothly animate visual height toward actual height
      const heightDiff = currentHeightRef.current - visualHeightRef.current
      if (Math.abs(heightDiff) > 0.1) {
        // Faster animation when boosting up, slower when falling
        const lerpSpeed = heightDiff > 0 ? GAME.LERP_SPEED_UP : GAME.LERP_SPEED_DOWN
        visualHeightRef.current += heightDiff * lerpSpeed * deltaTime
      } else {
        visualHeightRef.current = currentHeightRef.current
      }

      const displayHeight = Math.max(0, Math.min(100, visualHeightRef.current))

      // Calculate world offset based on rocket height
      // At 0% altitude, we see the ground. At 100%, we're deep in space
      const worldOffset = displayHeight * 2 // 0-200 range

      // Sky color gradient based on altitude
      if (displayHeight < GAME.GROUND_LEVEL) {
        // Near ground - darker blue
        ctx.fillStyle = '#1a1a3e'
      } else if (displayHeight < GAME.ATMOSPHERE_END) {
        // In atmosphere - gradient to darker
        const t = (displayHeight - GAME.GROUND_LEVEL) / (GAME.ATMOSPHERE_END - GAME.GROUND_LEVEL)
        const r = Math.floor(26 - t * 16)
        const g = Math.floor(26 - t * 16)
        const b = Math.floor(62 - t * 30)
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`
      } else {
        // Deep space
        ctx.fillStyle = '#0a0a20'
      }
      ctx.fillRect(0, 0, width, height)

      // Draw stars - parallax scrolling, more visible at higher altitudes
      const starAlphaMultiplier = Math.min(1, displayHeight / 40)
      stars.forEach((star) => {
        const twinkle = Math.sin(frameCount * 0.05 + star.twinkle) * 0.5 + 0.5
        const alpha = (0.3 + twinkle * 0.7) * starAlphaMultiplier

        // Parallax: stars scroll at different speeds based on "depth"
        const parallaxSpeed = 0.3 + (star.twinkle / Math.PI) * 0.4 // 0.3 to 0.7
        let starY = star.y + displayHeight * parallaxSpeed

        // Wrap stars to always fill the viewport
        starY = ((starY % 100) + 100) % 100

        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`
        ctx.fillRect(
          (star.x / 100) * width,
          (starY / 100) * height,
          star.size,
          star.size
        )
      })

      // Draw atmosphere clouds - always visible at bottom, fade as you go higher
      const cloudAlpha = Math.max(0, Math.min(0.6, (50 - displayHeight) / 50 * 0.7))

      if (cloudAlpha > 0.05) {
        ctx.fillStyle = `rgba(200, 210, 230, ${cloudAlpha})`

        // Draw cloud layer at bottom of screen
        const baseCloudY = height - 60
        drawCloud(ctx, 30 + Math.sin(frameCount * 0.01) * 5, baseCloudY, 70)
        drawCloud(ctx, 120 + Math.sin(frameCount * 0.012 + 1) * 5, baseCloudY + 20, 55)
        drawCloud(ctx, 200 + Math.sin(frameCount * 0.008 + 2) * 5, baseCloudY - 10, 65)
        drawCloud(ctx, 280 + Math.sin(frameCount * 0.011 + 3) * 5, baseCloudY + 15, 50)

        // Second layer slightly higher
        ctx.fillStyle = `rgba(180, 195, 220, ${cloudAlpha * 0.7})`
        drawCloud(ctx, 60 + Math.sin(frameCount * 0.009 + 4) * 6, baseCloudY - 40, 50)
        drawCloud(ctx, 160 + Math.sin(frameCount * 0.007 + 5) * 6, baseCloudY - 50, 60)
        drawCloud(ctx, 250 + Math.sin(frameCount * 0.01 + 6) * 6, baseCloudY - 35, 45)
      }

      // Draw ground (only visible at low altitudes)
      const groundScreenY = height + worldOffset * 1.5 - 30
      if (groundScreenY < height + 50) {
        // Ground base
        ctx.fillStyle = '#3d3d5c'
        ctx.fillRect(0, groundScreenY, width, height - groundScreenY + 50)

        // Ground detail pixels
        ctx.fillStyle = '#52527a'
        for (let x = 0; x < width; x += 8) {
          if ((x + frameCount) % 16 < 8) {
            ctx.fillRect(x, groundScreenY, 4, 4)
          }
        }

        // Launch pad
        ctx.fillStyle = '#666680'
        ctx.fillRect(width / 2 - 30, groundScreenY, 60, 10)
        ctx.fillStyle = '#ff6b6b'
        ctx.fillRect(width / 2 - 25, groundScreenY + 2, 8, 6)
        ctx.fillRect(width / 2 + 17, groundScreenY + 2, 8, 6)
      }

      // Rocket position - moves up/down based on altitude
      const rocketX = width / 2
      // At 100% altitude: rocket at 15% from top. At 0%: rocket at 80% from top
      const rocketY = height * (0.80 - (displayHeight / 100) * 0.65)

      if (crashed) {
        // Draw explosion
        drawPixelArt(ctx, EXPLOSION_PIXELS, rocketX - 21, rocketY - 21, 6, [
          '#ff6b6b', '#ffd93d', '#ff8c42', '#fff'
        ])

        // Falling debris particles
        ctx.fillStyle = '#888'
        for (let i = 0; i < 8; i++) {
          const angle = (frameCount * 0.1 + i * 0.8) % (Math.PI * 2)
          const dist = 20 + (frameCount % 60)
          ctx.fillRect(
            rocketX + Math.cos(angle) * dist,
            rocketY + Math.sin(angle) * dist + (frameCount % 60) * 0.5,
            3, 3
          )
        }
      } else {
        // Draw exhaust trail
        if (boosting) {
          ctx.fillStyle = 'rgba(255, 140, 66, 0.3)'
          for (let i = 0; i < 5; i++) {
            const trailY = rocketY + 30 + i * 15
            const trailWidth = 8 - i * 1.5
            ctx.fillRect(rocketX - trailWidth/2, trailY, trailWidth, 10)
          }
        }

        // Draw flame
        const flameVisible = boosting || frameCount % 8 < 5
        if (flameVisible) {
          const flameColors = boosting
            ? ['#ffd93d', '#ff8c42', '#ff6b6b']
            : ['#ff6b6b', '#ff8c42', '#995533']
          const flameScale = boosting ? 4 : 3
          drawPixelArt(ctx, FLAME_PIXELS, rocketX - 9, rocketY + 24, flameScale, flameColors)
        }

        // Draw rocket
        drawPixelArt(ctx, ROCKET_PIXELS, rocketX - 9, rocketY - 24, 3, [
          '#e0e0e0', '#c0c0c0', '#ff6b6b', '#4ecdc4'
        ])
      }

      // Draw coworker photo in corner
      if (photoImage) {
        ctx.fillStyle = '#fff'
        ctx.fillRect(width - 74, 10, 64, 64)
        const size = Math.min(photoImage.width, photoImage.height)
        const sx = (photoImage.width - size) / 2
        const sy = (photoImage.height - size) / 2
        ctx.drawImage(photoImage, sx, sy, size, size, width - 72, 12, 60, 60)
        ctx.strokeStyle = '#4ecdc4'
        ctx.lineWidth = 2
        ctx.strokeRect(width - 74, 10, 64, 64)
      } else if (coworkerPhoto) {
        ctx.fillStyle = '#2a2a4a'
        ctx.fillRect(width - 74, 10, 64, 64)
        ctx.strokeStyle = '#4ecdc4'
        ctx.lineWidth = 2
        ctx.strokeRect(width - 74, 10, 64, 64)
      }

      // Draw altitude meter (vertical bar on left)
      const meterX = 15
      const meterY = 50
      const meterHeight = 260
      const meterWidth = 14

      // Meter background
      ctx.fillStyle = '#1a1a3e'
      ctx.fillRect(meterX, meterY, meterWidth, meterHeight)
      ctx.strokeStyle = '#4ecdc4'
      ctx.lineWidth = 1
      ctx.strokeRect(meterX, meterY, meterWidth, meterHeight)

      // Danger zone (bottom 30%)
      ctx.fillStyle = 'rgba(255, 107, 107, 0.3)'
      ctx.fillRect(meterX + 1, meterY + meterHeight * 0.7, meterWidth - 2, meterHeight * 0.3 - 1)

      // Current altitude fill
      const fillHeight = (displayHeight / 100) * (meterHeight - 2)
      const gradient = ctx.createLinearGradient(0, meterY + meterHeight, 0, meterY)
      gradient.addColorStop(0, '#ff6b6b')
      gradient.addColorStop(0.3, '#ffd93d')
      gradient.addColorStop(1, '#4ecdc4')
      ctx.fillStyle = gradient
      ctx.fillRect(meterX + 1, meterY + meterHeight - fillHeight - 1, meterWidth - 2, fillHeight)

      // Altitude text
      ctx.fillStyle = '#4ecdc4'
      ctx.font = 'bold 11px monospace'
      ctx.textAlign = 'left'
      ctx.fillText('ALT', meterX, meterY - 5)
      ctx.fillText(`${Math.round(displayHeight)}%`, meterX, meterY + meterHeight + 15)

      // Draw danger warning when low
      if (displayHeight < GAME.DANGER_THRESHOLD && !crashed) {
        const flash = Math.sin(frameCount * 0.15) > 0
        if (flash) {
          ctx.fillStyle = '#ff6b6b'
          ctx.font = 'bold 12px monospace'
          ctx.textAlign = 'center'
          ctx.fillText('⚠ LOW ALTITUDE ⚠', width / 2, height - 15)
        }
      }

      animationRef.current = requestAnimationFrame(render)
    }

    render()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [stars, boosting, coworkerPhoto, photoImage, gravityActive, crashed, rocketHeight])

  return (
    <div className="rocket-game rounded-xl overflow-hidden border-4 border-[#2a2a4a]">
      <canvas
        ref={canvasRef}
        width={GAME.CANVAS_WIDTH}
        height={GAME.CANVAS_HEIGHT}
        className="w-full pixelated"
        style={{ imageRendering: 'pixelated' }}
      />
    </div>
  )
}

// Helper to draw pixel art from a pattern
function drawPixelArt(ctx, pattern, x, y, scale, colors) {
  pattern.forEach((row, py) => {
    for (let px = 0; px < row.length; px++) {
      if (row[px] === '#') {
        const colorIndex = (px + py) % colors.length
        ctx.fillStyle = colors[colorIndex]
        ctx.fillRect(x + px * scale, y + py * scale, scale, scale)
      }
    }
  })
}

// Helper to draw a simple cloud
function drawCloud(ctx, x, y, size) {
  ctx.beginPath()
  ctx.arc(x, y, size * 0.3, 0, Math.PI * 2)
  ctx.arc(x + size * 0.25, y - size * 0.15, size * 0.35, 0, Math.PI * 2)
  ctx.arc(x + size * 0.5, y, size * 0.28, 0, Math.PI * 2)
  ctx.arc(x + size * 0.25, y + size * 0.1, size * 0.25, 0, Math.PI * 2)
  ctx.fill()
}
