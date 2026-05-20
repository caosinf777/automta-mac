/**
 * AutoMTA Mac — System Permissions Manager
 * Gestiona los permisos de macOS necesarios para Computer Use
 */

import { systemPreferences, BrowserWindow, dialog, shell } from 'electron';
import { execSync } from 'child_process';

export interface PermissionsStatus {
  screen: 'granted' | 'denied' | 'not-determined';
  accessibility: 'granted' | 'denied' | 'not-determined';
}

/**
 * Get the current status of required system permissions
 */
export function getPermissionsStatus(): PermissionsStatus {
  let screenStatus: 'granted' | 'denied' | 'not-determined' = 'not-determined';
  let accessibilityStatus: 'granted' | 'denied' | 'not-determined' = 'not-determined';

  try {
    // Check Screen Recording permission
    const screenMedia = systemPreferences.getMediaAccessStatus('screen');
    if (screenMedia === 'granted') {
      screenStatus = 'granted';
    } else if (screenMedia === 'denied') {
      screenStatus = 'denied';
    } else {
      screenStatus = 'not-determined';
    }
  } catch (error) {
    console.warn('[Permissions] Could not check screen permission:', error);
  }

  try {
    // Check Accessibility permission (for mouse/keyboard control)
    const isAccessible = systemPreferences.isTrustedAccessibilityClient(false);
    accessibilityStatus = isAccessible ? 'granted' : 'not-determined';
  } catch (error) {
    console.warn('[Permissions] Could not check accessibility permission:', error);
  }

  return { screen: screenStatus, accessibility: accessibilityStatus };
}

/**
 * Request Screen Recording permission
 */
export async function requestScreenPermission(): Promise<'granted' | 'denied' | 'not-determined'> {
  try {
    // On macOS, we can only prompt, not directly request
    // The user must go to System Settings manually
    const status = systemPreferences.getMediaAccessStatus('screen');

    if (status !== 'granted') {
      // Show dialog guiding user to System Settings
      const { response } = await dialog.showMessageBox({
        type: 'info',
        title: 'Permiso de grabación de pantalla',
        message: 'AutoMTA necesita permiso para grabar la pantalla',
        detail: 'Para usar Computer Use, AutoMTA necesita ver tu pantalla.\n\n1. Haz clic en "Abrir Configuración"\n2. Ve a Privacidad y seguridad → Grabación de pantalla\n3. Activa el permiso para AutoMTA\n4. Reinicia AutoMTA',
        buttons: ['Abrir Configuración', 'Más tarde'],
        defaultId: 0,
        cancelId: 1,
      });

      if (response === 0) {
        shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');
      }
    }

    return status as 'granted' | 'denied' | 'not-determined';
  } catch (error) {
    console.error('[Permissions] Error requesting screen permission:', error);
    return 'not-determined';
  }
}

/**
 * Request Accessibility permission (for mouse/keyboard control)
 */
export async function requestAccessibilityPermission(): Promise<'granted' | 'denied' | 'not-determined'> {
  try {
    // This actually triggers the system dialog for accessibility
    const isGranted = systemPreferences.isTrustedAccessibilityClient(true);

    if (!isGranted) {
      const { response } = await dialog.showMessageBox({
        type: 'info',
        title: 'Permiso de accesibilidad',
        message: 'AutoMTA necesita permiso de accesibilidad',
        detail: 'Para controlar el mouse y teclado, AutoMTA necesita permiso de accesibilidad.\n\n1. Haz clic en "Abrir Configuración"\n2. Ve a Privacidad y seguridad → Accesibilidad\n3. Activa el permiso para AutoMTA\n4. La app se actualizará automáticamente',
        buttons: ['Abrir Configuración', 'Más tarde'],
        defaultId: 0,
        cancelId: 1,
      });

      if (response === 0) {
        shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility');
      }

      return 'not-determined';
    }

    return 'granted';
  } catch (error) {
    console.error('[Permissions] Error requesting accessibility permission:', error);
    return 'not-determined';
  }
}

/**
 * Run the full permissions onboarding flow for first-time users
 * Called from main.ts after the first window loads
 */
export async function requestSystemPermissions(mainWindow: BrowserWindow): Promise<void> {
  const status = getPermissionsStatus();

  if (status.screen === 'granted' && status.accessibility === 'granted') {
    console.log('[Permissions] All permissions already granted');
    return;
  }

  // Send permissions status to renderer so it can show the setup UI
  mainWindow.webContents.send('system:permissions-status', status);

  // Show an introductory dialog
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: '¡Bienvenido a AutoMTA!',
    message: 'Configurar permisos para Computer Use',
    detail: 'AutoMTA puede controlar tu computadora para completar tareas automáticamente.\n\nPara habilitar esta función, necesitamos dos permisos:\n\n• Grabación de pantalla: Para ver lo que está en tu pantalla\n• Accesibilidad: Para controlar el mouse y teclado\n\nPuedes otorgar estos permisos ahora o más tarde en Configuración.',
    buttons: ['Configurar ahora', 'Más tarde'],
    defaultId: 0,
    cancelId: 1,
    icon: undefined,
  });

  if (response === 0) {
    // Guide user through permissions step by step
    if (status.screen !== 'granted') {
      await requestScreenPermission();
    }

    await new Promise(resolve => setTimeout(resolve, 500));

    if (status.accessibility !== 'granted') {
      await requestAccessibilityPermission();
    }
  }
}
