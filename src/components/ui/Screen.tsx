import { ReactNode } from 'react';
import { SafeAreaView, StatusBar, StyleSheet } from 'react-native';
import { colors } from '../../theme';

interface ScreenProps {
  children: ReactNode;
}

export function Screen({ children }: ScreenProps) {
  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg0} />
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg0,
    overflow: 'hidden',
    position: 'relative',
  },
});
