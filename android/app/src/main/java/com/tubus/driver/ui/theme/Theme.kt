package com.tubus.driver.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val LightColors = lightColorScheme(
    primary = Brand,
    onPrimary = Color.White,
    background = LightBackground,
    onBackground = LightOnBackground,
    surface = LightBackground,
    onSurface = LightOnBackground,
    surfaceVariant = LightSurfaceVariant,
    outline = LightOutline,
    error = Danger,
    onError = Color.White,
)

private val DarkColors = darkColorScheme(
    primary = BrandDark,
    onPrimary = Color.Black,
    background = DarkBackground,
    onBackground = DarkOnBackground,
    surface = DarkBackground,
    onSurface = DarkOnBackground,
    surfaceVariant = DarkSurfaceVariant,
    outline = DarkOutline,
    error = DangerDark,
    onError = Color.Black,
)

/** Replaces the bare `MaterialTheme { ... }` in MainActivity.kt with a real color scheme
 * (previously stock M3 defaults — no brand identity, `ui/theme/` was an empty package). */
@Composable
fun TuBusTheme(darkTheme: Boolean = isSystemInDarkTheme(), content: @Composable () -> Unit) {
    val colors = if (darkTheme) DarkColors else LightColors
    MaterialTheme(colorScheme = colors, typography = TuBusTypography, content = content)
}
