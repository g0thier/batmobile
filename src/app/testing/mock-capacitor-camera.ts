export const CameraResultType = {
  DataUrl: 'dataUrl',
} as const;

export const CameraSource = {
  Camera: 'CAMERA',
  Photos: 'PHOTOS',
  Prompt: 'PROMPT',
} as const;

export const Camera = {
  async getPhoto() {
    return {
      dataUrl: 'data:image/png;base64,stub',
    };
  },
};
