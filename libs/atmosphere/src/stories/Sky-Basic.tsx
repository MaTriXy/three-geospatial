import { CameraControls, GizmoHelper, GizmoViewport } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { EffectComposer, SMAA, ToneMapping } from '@react-three/postprocessing'
import { type StoryFn } from '@storybook/react'
import { useControls } from 'leva'
import { ToneMappingMode } from 'postprocessing'
import { useEffect, useMemo, useRef, type ComponentRef, type FC } from 'react'
import { Vector3 } from 'three'

import {
  Ellipsoid,
  Geodetic,
  getMoonDirectionECEF,
  getSunDirectionECEF,
  radians
} from '@geovanni/core'
import { Dithering, LensFlare } from '@geovanni/effects/react'

import { Sky, type SkyImpl } from '../react/Sky'
import { useLocalDateControls } from './helpers/useLocalDateControls'
import { useRendererControls } from './helpers/useRendererControls'

const location = new Geodetic()
const position = new Vector3()
const up = new Vector3()

const Scene: FC = () => {
  useRendererControls({ exposure: 10 })

  const { longitude, latitude, height } = useControls('location', {
    longitude: { value: 0, min: -180, max: 180 },
    latitude: { value: 35, min: -90, max: 90 },
    height: { value: 2000, min: 0, max: 30000 }
  })

  const camera = useThree(({ camera }) => camera)
  const controlsRef = useRef<ComponentRef<typeof CameraControls>>(null)
  useEffect(() => {
    location.set(radians(longitude), radians(latitude), height)
    location.toECEF(position)
    Ellipsoid.WGS84.getSurfaceNormal(position, up)
    camera.up.copy(up)

    const controls = controlsRef.current
    if (controls == null) {
      return
    }
    controls.updateCameraUp()
    void controls.moveTo(position.x, position.y, position.z)
  }, [longitude, latitude, height, camera])

  const { osculateEllipsoid, photometric } = useControls('atmosphere', {
    osculateEllipsoid: true,
    photometric: false
  })

  const motionDate = useLocalDateControls({
    longitude,
    timeOfDay: 9,
    dayOfYear: 0
  })
  const sunDirectionRef = useRef(new Vector3())
  const moonDirectionRef = useRef(new Vector3())
  const skyRef = useRef<SkyImpl>(null)

  useFrame(() => {
    const date = new Date(motionDate.get())
    getSunDirectionECEF(date, sunDirectionRef.current)
    getMoonDirectionECEF(date, moonDirectionRef.current)
    if (skyRef.current != null) {
      skyRef.current.material.sunDirection = sunDirectionRef.current
      skyRef.current.material.moonDirection = moonDirectionRef.current
    }
  })

  const effectComposer = useMemo(
    () => (
      <EffectComposer key={Math.random()} multisampling={0}>
        <LensFlare />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        <SMAA />
        <Dithering />
      </EffectComposer>
    ),
    []
  )

  return (
    <>
      <CameraControls ref={controlsRef} minDistance={5} dollySpeed={0.05} />
      <GizmoHelper alignment='top-left' renderPriority={2}>
        <GizmoViewport />
      </GizmoHelper>
      <Sky
        ref={skyRef}
        osculateEllipsoid={osculateEllipsoid}
        photometric={photometric}
      />
      {effectComposer}
    </>
  )
}

export const Basic: StoryFn = () => {
  return (
    <Canvas
      gl={{
        antialias: false,
        depth: false,
        stencil: false
      }}
    >
      <Scene />
    </Canvas>
  )
}
