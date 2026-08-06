import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import Rastreadortrajeto from './src/screens/Rastreadortrajeto';

export default function App() {
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Rastreadortrajeto />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
});
