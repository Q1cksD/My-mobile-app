import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

interface BackgroundDecorProps {
  style?: StyleProp<ViewStyle>;
}

export function BackgroundDecor({ style }: BackgroundDecorProps) {
  return (
    <View pointerEvents="none" style={[styles.container, style]}>
      <View style={[styles.blob, styles.blobTop]} />
      <View style={[styles.blob, styles.blobBottom]} />
      <View style={styles.muteLayer} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  blob: {
    position: 'absolute',
    borderRadius: 9999,
  },
  blobTop: {
    width: 560,
    height: 560,
    top: -300,
    left: -230,
    backgroundColor: 'rgba(96,110,170,0.06)',
  },
  blobBottom: {
    width: 500,
    height: 500,
    bottom: -280,
    right: -210,
    backgroundColor: 'rgba(70,92,148,0.04)',
  },
  muteLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11,15,26,0.26)',
  },
});
