import { useFrame, type PointsProps } from '@react-three/fiber'
import {
  forwardRef,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { mergeRefs } from 'react-merge-refs'
import { type Points } from 'three'

import { ArrayBufferLoader } from '@takram/three-geospatial'

import { type AtmosphereMaterialProps } from '../AtmosphereMaterialBase'
import { StarsGeometry } from '../StarsGeometry'
import {
  StarsMaterial,
  starsMaterialParametersDefaults
} from '../StarsMaterial'
import { AtmosphereContext } from './Atmosphere'
import { separateProps } from './separateProps'

export type StarsImpl = Points<StarsGeometry, StarsMaterial>

export interface StarsProps extends PointsProps, AtmosphereMaterialProps {
  data?: ArrayBuffer | string
  pointSize?: number
  radianceScale?: number
  background?: boolean
}

export const Stars = /*#__PURE__*/ forwardRef<StarsImpl, StarsProps>(
  function Stars({ data: dataProp, ...props }, forwardedRef) {
    const { textures, transientProps, ...contextProps } =
      useContext(AtmosphereContext)

    const [
      atmosphereParameters,
      { pointSize, radianceScale, background, ...others }
    ] = separateProps({
      ...starsMaterialParametersDefaults,
      ...contextProps,
      ...textures,
      ...props
    })

    const [data, setData] = useState(
      typeof dataProp !== 'string' ? dataProp : undefined
    )
    useEffect(() => {
      if (typeof dataProp === 'string') {
        const loader = new ArrayBufferLoader()
        ;(async () => {
          setData(await loader.loadAsync(dataProp))
        })().catch(error => {
          console.error(error)
        })
      } else if (dataProp != null) {
        setData(dataProp)
      } else {
        setData(undefined)
      }
    }, [dataProp])

    const geometry = useMemo(
      () => (data != null ? new StarsGeometry(data) : undefined),
      [data]
    )
    useEffect(() => {
      return () => {
        geometry?.dispose()
      }
    }, [geometry])

    const material = useMemo(() => new StarsMaterial(), [])
    useEffect(() => {
      return () => {
        material.dispose()
      }
    }, [material])

    const ref = useRef<Points>(null)
    useFrame(() => {
      if (transientProps != null) {
        material.sunDirection.copy(transientProps.sunDirection)
        ref.current?.setRotationFromMatrix(transientProps.rotationMatrix)
      }
    })

    return (
      <points
        ref={mergeRefs([ref, forwardedRef])}
        {...others}
        frustumCulled={false}
      >
        {geometry != null && <primitive object={geometry} />}
        <primitive
          object={material}
          {...atmosphereParameters}
          pointSize={pointSize}
          radianceScale={radianceScale}
          background={background}
          depthTest={true}
          depthWrite={false}
        />
      </points>
    )
  }
)
