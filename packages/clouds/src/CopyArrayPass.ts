import { CopyPass } from 'postprocessing'
import { LinearFilter, WebGLArrayRenderTarget, type WebGLRenderer } from 'three'

import { CopyArrayMaterial } from './CopyArrayMaterial'
import { setMRTArrayRenderTarget } from './helpers/setMRTArrayRenderTarget'

export class CopyArrayPass extends CopyPass {
  declare renderTarget: WebGLArrayRenderTarget

  constructor(renderTarget?: WebGLArrayRenderTarget, autoResize?: boolean) {
    if (renderTarget == null) {
      renderTarget = new WebGLArrayRenderTarget(1, 1, 1, {
        stencilBuffer: false,
        depthBuffer: false
      })
      renderTarget.texture.minFilter = LinearFilter
      renderTarget.texture.magFilter = LinearFilter
      renderTarget.texture.name = 'CopyPass.Target'
    }
    super(renderTarget, autoResize)
    this.fullscreenMaterial = new CopyArrayMaterial()
  }

  override render(
    renderer: WebGLRenderer,
    inputBuffer: WebGLArrayRenderTarget,
    outputBuffer: WebGLArrayRenderTarget | null,
    deltaTime?: number,
    stencilTest?: boolean
  ): void {
    const material = this.fullscreenMaterial as CopyArrayMaterial
    material.inputBuffer = inputBuffer.texture
    setMRTArrayRenderTarget(
      renderer,
      this.renderToScreen ? null : this.renderTarget
    )
    renderer.render(this.scene, this.camera)
  }

  override setSize(width: number, height: number, depth?: number): void {
    if (this.autoResize) {
      this.renderTarget.setSize(width, height, depth ?? this.renderTarget.depth)
    }
  }

  get layerCount(): number {
    const material = this.fullscreenMaterial as CopyArrayMaterial
    return +material.defines.LAYER_COUNT
  }

  set layerCount(value: number) {
    if (value !== this.layerCount) {
      const material = this.fullscreenMaterial as CopyArrayMaterial
      material.defines.LAYER_COUNT = `${value}`
      material.needsUpdate = true
    }
  }
}
