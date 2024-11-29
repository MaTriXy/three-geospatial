// Copy-pasted from:
// https://github.com/NASA-AMMOS/3DTilesRendererJS/blob/v0.3.41/example/src/plugins/UpdateOnChangePlugin.js

import { Matrix4 } from 'three'

const _matrix = /*#__PURE__*/ new Matrix4()

export class UpdateOnChangePlugin {
  constructor() {
    this.name = 'UPDATE_ON_CHANGE_PLUGIN'
    this.tiles = null
    this.needsUpdate = false
    this.cameraMatrices = new Map()
  }

  init(tiles) {
    this.tiles = tiles

    // register callbacks to add cameras and force a new update
    this._needsUpdateCallback = () => {
      this.needsUpdate = true
    }
    this._onCameraAdd = ({ camera }) => {
      this.needsUpdate = true
      this.cameraMatrices.set(camera, new Matrix4())
    }
    this._onCameraDelete = ({ camera }) => {
      this.needsUpdate = true
      this.cameraMatrices.delete(camera)
    }

    tiles.addEventListener(
      'camera-resolution-change',
      this._needsUpdateCallback
    )
    tiles.addEventListener('load-content', this._needsUpdateCallback)
    tiles.addEventListener('add-camera', this._onCameraAdd)
    tiles.addEventListener('delete-camera', this._onCameraDelete)

    // register any already-present cameras
    tiles.cameras.forEach(camera => {
      this._onCameraAdd({ camera })
    })
  }

  doTilesNeedUpdate() {
    const tiles = this.tiles
    let didCamerasChange = false
    this.cameraMatrices.forEach((matrix, camera) => {
      // check if the camera position or frustum changed by comparing the MVP
      // matrix between frames
      _matrix
        .copy(tiles.group.matrixWorld)
        .premultiply(camera.matrixWorldInverse)
        .premultiply(camera.projectionMatrixInverse)

      didCamerasChange = didCamerasChange || !_matrix.equals(matrix)
      matrix.copy(_matrix)
    })

    const needsUpdate = this.needsUpdate
    this.needsUpdate = false

    return needsUpdate || didCamerasChange
  }

  dispose() {
    const tiles = this.tiles
    tiles.removeEventListener(
      'camera-resolution-change',
      this._needsUpdateCallback
    )
    tiles.removeEventListener('content-load', this._needsUpdateCallback)
    tiles.removeEventListener('camera-add', this._onCameraAdd)
    tiles.removeEventListener('camera-delete', this._onCameraDelete)
  }
}
