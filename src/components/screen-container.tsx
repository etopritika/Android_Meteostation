import { type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { strings } from '@/constants/strings';
import { palette } from '@/theme/palette';
import { tokens } from '@/theme/tokens';

type ScreenContainerProps = {
  children: ReactNode;
};

type ScreenTitleProps = {
  title?: string;
  onPress?: () => void;
};

export function ScreenContainer({ children }: ScreenContainerProps) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'right', 'bottom', 'left']}>
      <View style={styles.content}>{children}</View>
    </SafeAreaView>
  );
}

export function ScreenTitle({ title = strings.app.title, onPress }: ScreenTitleProps) {
  return (
    <Text style={styles.title} onPress={onPress}>
      {title}
    </Text>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: palette.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: tokens.space.lg,
    paddingTop: 28,
    paddingBottom: tokens.space.lg,
  },
  title: {
    color: palette.text,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '700',
  },
});
