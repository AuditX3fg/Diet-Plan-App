import { Image, StyleSheet } from 'react-native'

const nutritionFingerprint = require('../../assets/brand/tawazon-nutrition-fingerprint-icon-v5.png')

export function BrandMark({ size = 48 }: { size?: number }) {
  return (
    <Image
      accessibilityLabel="Tawazon nutrition fingerprint logo"
      accessibilityRole="image"
      resizeMode="cover"
      source={nutritionFingerprint}
      style={[styles.image, { width: size, height: size, borderRadius: Math.round(size * 0.27) }]}
    />
  )
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: '#FBF8F1',
  },
})
