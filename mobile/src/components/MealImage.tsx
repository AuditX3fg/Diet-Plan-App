import { Image, StyleSheet, Text, View } from 'react-native'
import { mealImages } from '../mealImages'

export function MealImage({ imageKey, glyph, size = 64, radius = 18 }: { imageKey?: string; glyph: string; size?: number; radius?: number }) {
  const source = imageKey ? mealImages[imageKey] : undefined
  if (source) return <Image source={source} resizeMode="cover" style={{ width: size, height: size, borderRadius: radius }} />
  return <View style={[styles.fallback, { width: size, height: size, borderRadius: radius }]}><Text style={{ fontSize: Math.round(size * 0.38) }}>{glyph}</Text></View>
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#edf3f0' },
})
