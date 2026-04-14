import { create } from 'zustand'

export interface UploadAsset {
  file: File
  previewUrl: string
}

interface ThemeState {
  themeName: string
  author: string
  description: string
  flags: {
    homeVisible: boolean
    allow3D: boolean
  }
  bgmFile: File | null
  upperImage: UploadAsset | null
  lowerImage: UploadAsset | null
  folderIcon: UploadAsset | null
  fileIcon: UploadAsset | null
  setThemeName: (value: string) => void
  setAuthor: (value: string) => void
  setDescription: (value: string) => void
  setFlag: (key: keyof ThemeState['flags'], value: boolean) => void
  setBgmFile: (file: File | null) => void
  setUpperImage: (asset: UploadAsset | null) => void
  setLowerImage: (asset: UploadAsset | null) => void
  setFolderIcon: (asset: UploadAsset | null) => void
  setFileIcon: (asset: UploadAsset | null) => void
}

export const useThemeStore = create<ThemeState>((set) => ({
  themeName: 'Mi Tema 3DS',
  author: 'Autor',
  description: 'Descripción breve del tema.',
  flags: {
    homeVisible: true,
    allow3D: false,
  },
  bgmFile: null,
  upperImage: null,
  lowerImage: null,
  folderIcon: null,
  fileIcon: null,
  setThemeName: (themeName) => set(() => ({ themeName })),
  setAuthor: (author) => set(() => ({ author })),
  setDescription: (description) => set(() => ({ description })),
  setFlag: (key, value) => set((state) => ({ flags: { ...state.flags, [key]: value } })),
  setBgmFile: (bgmFile) => set(() => ({ bgmFile })),
  setUpperImage: (upperImage) => set(() => ({ upperImage })),
  setLowerImage: (lowerImage) => set(() => ({ lowerImage })),
  setFolderIcon: (folderIcon) => set(() => ({ folderIcon })),
  setFileIcon: (fileIcon) => set(() => ({ fileIcon })),
}))
