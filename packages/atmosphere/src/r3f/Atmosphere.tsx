import { useThree } from '@react-three/fiber'
import {
  createContext,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'
import { Matrix4, Vector2, Vector3, type Texture } from 'three'

import { Ellipsoid } from '@takram/three-geospatial'

import {
  getECIToECEFRotationMatrix,
  getMoonDirectionECI,
  getSunDirectionECI
} from '../celestialDirections'
import {
  PrecomputedTexturesLoader,
  type PrecomputedTextures
} from '../PrecomputedTexturesLoader'

export interface AtmosphereTransientProps {
  sunDirection: Vector3
  moonDirection: Vector3
  rotationMatrix: Matrix4
  shadowMatrices: Matrix4[]
  shadowCascades: Vector2[]
  shadowFar: number
}

export interface AtmosphereContextValue {
  textures?: PrecomputedTextures | null
  useHalfFloat?: boolean
  ellipsoid?: Ellipsoid
  correctAltitude?: boolean
  photometric?: boolean
  transientProps?: AtmosphereTransientProps
  shadowBuffer?: Texture | null
  setShadowBuffer?: (value: Texture | null) => void
}

export const AtmosphereContext = createContext<AtmosphereContextValue>({})

export interface AtmosphereProps {
  textures?: PrecomputedTextures | string
  useHalfFloat?: boolean
  ellipsoid?: Ellipsoid
  correctAltitude?: boolean
  photometric?: boolean
  date?: number | Date
  children?: ReactNode
}

export interface AtmosphereApi extends AtmosphereTransientProps {
  textures?: PrecomputedTextures
  updateByDate: (date: number | Date) => void
}

export const Atmosphere = /*#__PURE__*/ forwardRef<
  AtmosphereApi,
  AtmosphereProps
>(function Atmosphere(
  {
    textures: texturesProp,
    useHalfFloat,
    ellipsoid = Ellipsoid.WGS84,
    correctAltitude = true,
    photometric = true,
    date,
    children
  },
  forwardedRef
) {
  const transientPropsRef = useRef({
    sunDirection: new Vector3(),
    moonDirection: new Vector3(),
    rotationMatrix: new Matrix4(),
    shadowMatrices: [
      new Matrix4(),
      new Matrix4(),
      new Matrix4(),
      new Matrix4()
    ],
    shadowCascades: [
      new Vector2(),
      new Vector2(),
      new Vector2(),
      new Vector2()
    ],
    shadowFar: 0
  })

  const gl = useThree(({ gl }) => gl)
  if (useHalfFloat == null) {
    useHalfFloat =
      gl.getContext().getExtension('OES_texture_float_linear') == null
  }

  const [textures, setTextures] = useState(
    typeof texturesProp !== 'string' ? texturesProp : undefined
  )
  useEffect(() => {
    if (typeof texturesProp === 'string') {
      const loader = new PrecomputedTexturesLoader()
      loader.useHalfFloat = useHalfFloat
      ;(async () => {
        setTextures(await loader.loadAsync(texturesProp))
      })().catch(error => {
        console.error(error)
      })
    } else if (texturesProp != null) {
      setTextures(texturesProp)
    } else {
      setTextures(undefined)
    }
  }, [texturesProp, useHalfFloat])

  const [shadowBuffer, setShadowBuffer] = useState<Texture | null>(null)

  const context = useMemo(
    () => ({
      textures,
      useHalfFloat,
      ellipsoid,
      correctAltitude,
      photometric,
      transientProps: transientPropsRef.current,
      shadowBuffer,
      setShadowBuffer
    }),
    [
      textures,
      useHalfFloat,
      ellipsoid,
      correctAltitude,
      photometric,
      shadowBuffer,
      setShadowBuffer
    ]
  )

  const updateByDate: AtmosphereApi['updateByDate'] = useMemo(() => {
    const { sunDirection, moonDirection, rotationMatrix } =
      transientPropsRef.current
    return date => {
      getECIToECEFRotationMatrix(date, rotationMatrix)
      getSunDirectionECI(date, sunDirection).applyMatrix4(rotationMatrix)
      getMoonDirectionECI(date, moonDirection).applyMatrix4(rotationMatrix)
    }
  }, [])

  const timestamp = date != null && !isNaN(+date) ? +date : undefined
  useEffect(() => {
    if (timestamp != null) {
      updateByDate(timestamp)
    }
  }, [timestamp, updateByDate])

  useImperativeHandle(
    forwardedRef,
    () => ({
      ...transientPropsRef.current,
      textures,
      updateByDate
    }),
    [textures, updateByDate]
  )

  return (
    <AtmosphereContext.Provider value={context}>
      {children}
    </AtmosphereContext.Provider>
  )
})
