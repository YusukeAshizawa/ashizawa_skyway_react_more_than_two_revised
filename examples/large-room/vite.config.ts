import react from '@vitejs/plugin-react';
import * as fs from 'fs';
import * as path from 'path';
import { defineConfig } from 'vite';
import { mediapipe } from 'vite-plugin-mediapipe';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), mediapipe(), mediapipe_workaround()],
  // base: './',
  base: '/ashizawa_skyway_react_more_than_two_revised/', // GitHub Pagesのリポジトリ名
  resolve: {
    alias: {
      '@skyway-sdk/common': '@skyway-sdk/common/dist',
      '@skyway-sdk/core': '@skyway-sdk/core/dist',
      '@skyway-sdk/rtc-api-client': '@skyway-sdk/rtc-api-client/dist',
      '@skyway-sdk/rtc-rpc-api-client': '@skyway-sdk/rtc-rpc-api-client/dist',
      '@skyway-sdk/sfu-bot': '@skyway-sdk/sfu-bot/dist',
      '@skyway-sdk/sfu-api-client': '@skyway-sdk/sfu-api-client/dist',
      '@skyway-sdk/message-client': '@skyway-sdk/message-client/dist',
      '@skyway-sdk/token': '@skyway-sdk/token/dist',
    },
  },
});

function mediapipe_workaround() {
  return {
    name: 'mediapipe_workaround',
    load(id) {
      if (path.basename(id) === 'face_mesh.js') {
        let code = fs.readFileSync(id, 'utf-8');
        code += 'exports.FaceMesh = FaceMesh;';
        return { code };
      } else {
        return null;
      }
    },
  };
}
