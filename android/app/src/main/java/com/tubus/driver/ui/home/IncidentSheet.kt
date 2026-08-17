package com.tubus.driver.ui.home

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.selection.selectable
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

private val CATEGORIES = listOf(
    "VEHICLE" to "Problema con el vehículo",
    "TRAFFIC" to "Tráfico / incidente en la vía",
    "VEHICLE_CHANGE" to "Cambio de vehículo",
    "OTHER" to "Otro",
)

/**
 * SPECS.md §6's "optional MVP feature" — a driver reports what's happening on the trip
 * (not an alert to anyone, that's a deliberate follow-up), category plus an optional
 * note. Kept as an AlertDialog rather than a bottom sheet, matching the one other
 * confirmation pattern already in this app (the end-trip dialog) instead of introducing
 * a second interaction shape for a single screen.
 */
@Composable
fun IncidentSheet(submitting: Boolean, onDismiss: () -> Unit, onSubmit: (category: String, note: String?) -> Unit) {
    var selectedCategory by remember { mutableStateOf(CATEGORIES.first().first) }
    var note by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = { if (!submitting) onDismiss() },
        title = { Text("Reportar incidente") },
        text = {
            Column {
                CATEGORIES.forEach { (value, label) ->
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .selectable(
                                selected = selectedCategory == value,
                                onClick = { selectedCategory = value },
                            ),
                    ) {
                        androidx.compose.foundation.layout.Row(
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            RadioButton(selected = selectedCategory == value, onClick = { selectedCategory = value })
                            Text(
                                label,
                                style = MaterialTheme.typography.bodyMedium,
                                modifier = Modifier.padding(top = 12.dp, start = 4.dp),
                            )
                        }
                    }
                }
                OutlinedTextField(
                    value = note,
                    onValueChange = { note = it },
                    label = { Text("Nota (opcional)") },
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                )
            }
        },
        confirmButton = {
            TextButton(
                enabled = !submitting,
                onClick = { onSubmit(selectedCategory, note.ifBlank { null }) },
            ) {
                Text(if (submitting) "Enviando…" else "Reportar")
            }
        },
        dismissButton = {
            TextButton(enabled = !submitting, onClick = onDismiss) {
                Text("Cancelar")
            }
        },
    )
}
