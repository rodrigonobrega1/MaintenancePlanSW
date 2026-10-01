Attribute VB_Name = "MaintenancePlanning"
Option Explicit

Private Function Normalized(ByVal source As Variant) As String
    Dim expression As Object
    Set expression = CreateObject("VBScript.RegExp")
    expression.Global = True
    expression.Pattern = "[^A-Z0-9]"
    Normalized = expression.Replace(UCase$(Trim$(CStr(source))), "")
End Function

Private Function ColumnNumber(ByVal sheet As Worksheet, ByVal heading As String) As Long
    Dim column As Long
    For column = 1 To sheet.Cells(1, sheet.Columns.Count).End(xlToLeft).Column
        If Normalized(sheet.Cells(1, column).Value2) = Normalized(heading) Then
            ColumnNumber = column
            Exit Function
        End If
    Next column
    Err.Raise vbObjectError + 100, , sheet.Name & " is missing column: " & heading
End Function

Private Function CellDate(ByVal rawValue As Variant) As Date
    Dim parts() As String, text As String
    If IsError(rawValue) Or IsEmpty(rawValue) Then Exit Function
    text = Trim$(CStr(rawValue))
    If Len(text) = 0 Then Exit Function
    On Error GoTo InvalidDate
    If IsNumeric(rawValue) Then
        If CDbl(rawValue) > 10000 Then CellDate = DateSerial(1899, 12, 30) + CDbl(rawValue)
    ElseIf InStr(text, "/") > 0 Then
        parts = Split(text, "/")
        If UBound(parts) = 2 Then CellDate = DateSerial(CInt(parts(2)), CInt(parts(1)), CInt(parts(0)))
    ElseIf Len(text) >= 10 And Mid$(text, 5, 1) = "-" Then
        CellDate = DateSerial(CInt(Left$(text, 4)), CInt(Mid$(text, 6, 2)), CInt(Mid$(text, 9, 2)))
    ElseIf IsDate(rawValue) Then
        CellDate = CDate(rawValue)
    End If
    Exit Function
InvalidDate:
    CellDate = 0
End Function

Private Function IntervalCount(ByVal frequency As String, ByVal unit As String) As Long
    Dim pieces() As String
    pieces = Split(frequency, "-")
    If UBound(pieces) = 1 Then
        If pieces(1) = unit And IsNumeric(pieces(0)) Then IntervalCount = CLng(pieces(0))
    End If
End Function

Private Function MedianSpacing(ByVal dates As Collection) As Double
    Dim values() As Double, gaps() As Double, i As Long, j As Long, swap As Double, count As Long
    If dates.Count < 2 Then Exit Function
    ReDim values(1 To dates.Count)
    For i = 1 To dates.Count
        values(i) = CDbl(dates(i))
    Next i
    For i = 2 To UBound(values)
        swap = values(i): j = i - 1
        Do While j >= 1
            If values(j) <= swap Then Exit Do
            values(j + 1) = values(j): j = j - 1
        Loop
        values(j + 1) = swap
    Next i
    ReDim gaps(1 To dates.Count - 1)
    For i = 2 To UBound(values)
        If values(i) > values(i - 1) Then
            count = count + 1: gaps(count) = values(i) - values(i - 1)
        End If
    Next i
    If count = 0 Then Exit Function
    For i = 2 To count
        swap = gaps(i): j = i - 1
        Do While j >= 1
            If gaps(j) <= swap Then Exit Do
            gaps(j + 1) = gaps(j): j = j - 1
        Loop
        gaps(j + 1) = swap
    Next i
    MedianSpacing = gaps((count + 1) \ 2)
End Function

Private Function Cadence(ByVal description As String, ByVal dates As Collection) As String
    Dim text As String, pattern As Object, found As Object, amount As Long, unit As String, median As Double
    text = LCase$(description)
    median = MedianSpacing(dates)
    If InStr(text, "bi-weekly") > 0 Or InStr(text, "bi weekly") > 0 Then Cadence = "2-Weekly": Exit Function
    If InStr(text, "bi-monthly") > 0 Or InStr(text, "bi monthly") > 0 Then Cadence = "2-Monthly": Exit Function
    Set pattern = CreateObject("VBScript.RegExp")
    pattern.Pattern = "\b([0-9]+)(\s+|\-)(daily|days?|weekly|weeks?|monthly|months?|mths?|mth)\b"
    pattern.IgnoreCase = True
    If pattern.Test(text) Then
        Set found = pattern.Execute(text)(0)
        amount = CLng(found.SubMatches(0)): unit = found.SubMatches(2)
        If InStr(unit, "week") Then
            If median > 0 And median <= 9 Then Cadence = "Weekly" Else Cadence = CStr(amount) & "-Weekly"
            Exit Function
        ElseIf InStr(unit, "month") Or InStr(unit, "mth") Then
            Select Case amount
                Case 1: Cadence = "Monthly"
                Case 3: Cadence = "Quarterly"
                Case 6: Cadence = "Biannual"
                Case 12: Cadence = "Annual"
                Case Else: Cadence = CStr(amount) & "-Monthly"
            End Select
            Exit Function
        Else
            Cadence = CStr(amount) & "-Daily": If amount = 1 Then Cadence = "Daily"
            Exit Function
        End If
    End If
    If InStr(text, "daily") Or InStr(text, " day") Then Cadence = "Daily": Exit Function
    If InStr(text, "weekly") Or InStr(text, " week") Or InStr(text, "ppm check") Then Cadence = "Weekly": Exit Function
    If InStr(text, "quarter") Then Cadence = "Quarterly": Exit Function
    If InStr(text, "biannual") Or InStr(text, "6m") Then Cadence = "Biannual": Exit Function
    If InStr(text, "monthly") Or InStr(text, " month") Then Cadence = "Monthly": Exit Function
    If InStr(text, "annual") Or InStr(text, "12m") Or InStr(text, " year") Then Cadence = "Annual": Exit Function
    If median > 0 Then
        If median <= 9 Then
            Cadence = "Weekly"
        ElseIf median <= 17 Then
            Cadence = "2-Weekly"
        ElseIf median <= 45 Then
            Cadence = "Monthly"
        ElseIf median <= 65 Then
            Cadence = "8-Weekly"
        ElseIf median <= 110 Then
            Cadence = "Quarterly"
        ElseIf median <= 220 Then
            Cadence = "Biannual"
        Else
            Cadence = "Annual"
        End If
    Else
        Cadence = "Annual"
    End If
End Function

Private Function AnnualTarget(ByVal frequency As String, ByVal reportYear As Long) As Long
    Dim days As Long, count As Long
    days = DateDiff("d", DateSerial(reportYear, 1, 1), DateSerial(reportYear + 1, 1, 1))
    Select Case frequency
        Case "Daily": AnnualTarget = days
        Case "Weekly": AnnualTarget = (days + 6) \ 7
        Case "Monthly": AnnualTarget = 12
        Case "Quarterly": AnnualTarget = 4
        Case "Biannual": AnnualTarget = 2
        Case "Annual": AnnualTarget = 1
        Case Else
            count = IntervalCount(frequency, "Daily")
            If count > 0 Then AnnualTarget = (days + count - 1) \ count: Exit Function
            count = IntervalCount(frequency, "Weekly")
            If count > 0 Then AnnualTarget = (days + count * 7 - 1) \ (count * 7): Exit Function
            count = IntervalCount(frequency, "Monthly")
            If count > 0 Then AnnualTarget = (12 + count - 1) \ count Else AnnualTarget = 12
    End Select
End Function

Private Function ElapsedTarget(ByVal frequency As String, ByVal reportYear As Long, ByVal reference As Date) As Long
    Dim days As Long, months As Long, count As Long
    If Year(reference) < reportYear Then Exit Function
    If Year(reference) > reportYear Then ElapsedTarget = AnnualTarget(frequency, reportYear): Exit Function
    days = DateDiff("d", DateSerial(reportYear, 1, 1), reference) + 1
    months = Month(reference)
    Select Case frequency
        Case "Daily": ElapsedTarget = days
        Case "Weekly": ElapsedTarget = (days + 6) \ 7
        Case "Monthly": ElapsedTarget = months
        Case "Quarterly": ElapsedTarget = (months + 2) \ 3
        Case "Biannual": ElapsedTarget = (months + 5) \ 6
        Case "Annual": ElapsedTarget = 1
        Case Else
            count = IntervalCount(frequency, "Daily")
            If count > 0 Then ElapsedTarget = (days + count - 1) \ count: Exit Function
            count = IntervalCount(frequency, "Weekly")
            If count > 0 Then ElapsedTarget = (days + count * 7 - 1) \ (count * 7): Exit Function
            count = IntervalCount(frequency, "Monthly")
            If count > 0 Then ElapsedTarget = (months + count - 1) \ count Else ElapsedTarget = months
    End Select
End Function

Private Function PeriodKey(ByVal basicDate As Date, ByVal frequency As String) As String
    Dim weekStart As Date
    Select Case frequency
        Case "Annual": PeriodKey = Format$(basicDate, "yyyy")
        Case "Biannual": PeriodKey = Format$(basicDate, "yyyy") & "-H" & CStr((Month(basicDate) + 5) \ 6)
        Case "Quarterly": PeriodKey = Format$(basicDate, "yyyy") & "-Q" & CStr((Month(basicDate) + 2) \ 3)
        Case "Monthly": PeriodKey = Format$(basicDate, "yyyy-mm")
        Case "Weekly"
            weekStart = basicDate - Weekday(basicDate, vbMonday) + 1
            PeriodKey = Format$(weekStart, "yyyy-mm-dd")
        Case Else
            If IntervalCount(frequency, "Monthly") > 0 Then
                PeriodKey = Format$(basicDate, "yyyy-mm")
            ElseIf IntervalCount(frequency, "Weekly") > 0 Then
                weekStart = basicDate - Weekday(basicDate, vbMonday) + 1
                PeriodKey = Format$(weekStart, "yyyy-mm-dd")
            Else
                PeriodKey = Format$(basicDate, "yyyy-mm-dd")
            End If
    End Select
End Function

Private Function FollowingDue(ByVal completed As Date, ByVal frequency As String) As Date
    Dim count As Long
    count = IntervalCount(frequency, "Monthly")
    If count > 0 Then FollowingDue = DateAdd("m", count, completed): Exit Function
    count = IntervalCount(frequency, "Weekly")
    If count > 0 Then FollowingDue = DateAdd("d", count * 7, completed): Exit Function
    count = IntervalCount(frequency, "Daily")
    If count > 0 Then FollowingDue = DateAdd("d", count, completed): Exit Function
    Select Case frequency
        Case "Daily": FollowingDue = DateAdd("d", 1, completed)
        Case "Weekly": FollowingDue = DateAdd("d", 7, completed)
        Case "Monthly": FollowingDue = DateAdd("m", 1, completed)
        Case "Quarterly": FollowingDue = DateAdd("m", 3, completed)
        Case "Biannual": FollowingDue = DateAdd("m", 6, completed)
        Case Else: FollowingDue = DateAdd("m", 12, completed)
    End Select
End Function

Private Function NewRecord(ByVal code As String, ByVal description As String) As Object
    Dim record As Object, dates As Collection, periods As Object, orders As Object, planCompletions As Collection
    Set record = CreateObject("Scripting.Dictionary")
    Set dates = New Collection
    Set periods = CreateObject("Scripting.Dictionary")
    Set orders = CreateObject("Scripting.Dictionary")
    Set planCompletions = New Collection
    record.Add "Code", code: record.Add "Description", description
    record.Add "Dates", dates: record.Add "Periods", periods: record.Add "Orders", orders
    record.Add "PlanCompletions", planCompletions
    record.Add "Calls", 0: record.Add "Matches", 0: record.Add "Latest", 0#: record.Add "PlanLatest", 0#
    Set NewRecord = record
End Function

Private Sub AddRefreshButton(ByVal sheet As Worksheet)
    Dim shape As Shape
    On Error Resume Next
    Set shape = sheet.Shapes("RefreshMaintenance")
    On Error GoTo 0
    If shape Is Nothing Then
        Set shape = sheet.Shapes.AddShape(msoShapeRoundedRectangle, sheet.Range("G2").Left, sheet.Range("G2").Top, 165, 30)
        shape.Name = "RefreshMaintenance"
    End If
    shape.TextFrame.Characters.Text = "Refresh analysis"
    shape.Fill.ForeColor.RGB = RGB(35, 124, 97)
    shape.TextFrame.Characters.Font.Color = RGB(255, 255, 255)
    shape.Line.Visible = msoFalse
    shape.OnAction = "'" & ThisWorkbook.Name & "'!UpdateMaintenanceDashboard"
End Sub

Public Sub UpdateMaintenanceDashboard()
    Dim planSheet As Worksheet, executionSheet As Worksheet, analysis As Worksheet, board As Worksheet, settings As Worksheet
    Dim plans As Object, byCode As Object, record As Object, periods As Object, orders As Object, dates As Collection
    Dim planCode As String, description As String, groupKey As String, orderNumber As String, machine As String
    Dim code As Variant, group As Variant, rowNumber As Long, endRow As Long, outputRow As Long
    Dim codeColumn As Long, descriptionColumn As Long, planDateColumn As Long, planOrderColumn As Long, planCompletionColumn As Long
    Dim execCodeColumn As Long, execDescriptionColumn As Long, execOrderColumn As Long, basicColumn As Long, completeColumn As Long
    Dim basic As Date, completion As Date, latest As Date, dueDate As Date, reference As Date
    Dim reportYear As Long, target As Long, elapsed As Long, completed As Long, overdue As Long
    Dim frequency As String, priorityStatus As String, machineFilter As String
    Dim matches As Collection, machineStats As Object, stats As Object, boardRow As Long, machineRow As Long
    Dim totalTarget As Long, totalCompleted As Long, totalPlans As Long, overdueCount As Long, soonCount As Long
    On Error GoTo Failed
    Application.ScreenUpdating = False
    Application.EnableEvents = False
    Set planSheet = ThisWorkbook.Worksheets("Plan")
    Set executionSheet = ThisWorkbook.Worksheets("Execution")
    Set analysis = ThisWorkbook.Worksheets("Analysis")
    Set board = ThisWorkbook.Worksheets("Dashboard")
    Set settings = ThisWorkbook.Worksheets("Settings")
    reportYear = CLng(settings.Range("B3").Value2)
    reference = CellDate(settings.Range("B4").Value2)
    If reference = 0 Then Err.Raise vbObjectError + 101, , "Settings!B4 must contain a valid reference date."
    machineFilter = Trim$(CStr(settings.Range("B5").Value2))
    codeColumn = ColumnNumber(planSheet, "Maintenance Plan")
    descriptionColumn = ColumnNumber(planSheet, "Maintenance item description")
    planDateColumn = ColumnNumber(planSheet, "Scheduled start date")
    planOrderColumn = ColumnNumber(planSheet, "Order")
    planCompletionColumn = ColumnNumber(planSheet, "Completion date")
    execCodeColumn = ColumnNumber(executionSheet, "Maintenance Plan")
    execDescriptionColumn = ColumnNumber(executionSheet, "Description")
    execOrderColumn = ColumnNumber(executionSheet, "Order")
    basicColumn = ColumnNumber(executionSheet, "Basic start date")
    completeColumn = ColumnNumber(executionSheet, "Completion Date")
    Set plans = CreateObject("Scripting.Dictionary")
    Set byCode = CreateObject("Scripting.Dictionary")
    endRow = planSheet.Cells(planSheet.Rows.Count, descriptionColumn).End(xlUp).Row
    For rowNumber = 2 To endRow
        description = Trim$(CStr(planSheet.Cells(rowNumber, descriptionColumn).Value2))
        If Len(description) > 0 And UCase$(Left$(description, 5)) <> "COR -" Then
            planCode = Normalized(planSheet.Cells(rowNumber, codeColumn).Value2)
            groupKey = planCode & "|" & Normalized(description)
            If Not plans.Exists(groupKey) Then
                Set record = NewRecord(planCode, description)
                plans.Add groupKey, record
                If Not byCode.Exists(planCode) Then
                    Set matches = New Collection
                    byCode.Add planCode, matches
                End If
                Set matches = byCode(planCode)
                matches.Add groupKey
            End If
            Set record = plans(groupKey)
            record("Calls") = CLng(record("Calls")) + 1
            basic = CellDate(planSheet.Cells(rowNumber, planDateColumn).Value2)
            If basic > 0 Then
                Set dates = record("Dates")
                dates.Add basic
            End If
            completion = CellDate(planSheet.Cells(rowNumber, planCompletionColumn).Value2)
            If completion > 0 And completion <= reference Then
                If completion > CDbl(record("PlanLatest")) Then record("PlanLatest") = CDbl(completion)
                If basic > 0 And Year(completion) = reportYear Then
                    Set dates = record("PlanCompletions")
                    dates.Add basic
                End If
            End If
            orderNumber = Normalized(planSheet.Cells(rowNumber, planOrderColumn).Value2)
            If Len(orderNumber) > 0 Then
                Set orders = record("Orders")
                orders(orderNumber) = True
            End If
        End If
    Next rowNumber
    If plans.Count = 0 Then Err.Raise vbObjectError + 102, , "Paste plan records into Plan before refreshing."
    endRow = executionSheet.Cells(executionSheet.Rows.Count, execCodeColumn).End(xlUp).Row
    For rowNumber = 2 To endRow
        planCode = Normalized(executionSheet.Cells(rowNumber, execCodeColumn).Value2)
        If byCode.Exists(planCode) Then
            Set matches = byCode(planCode)
            Set record = Nothing
            If matches.Count = 1 Then
                Set record = plans(matches(1))
            Else
                description = Normalized(executionSheet.Cells(rowNumber, execDescriptionColumn).Value2)
                orderNumber = Normalized(executionSheet.Cells(rowNumber, execOrderColumn).Value2)
                For Each group In matches
                    Set record = plans(group)
                    Set orders = record("Orders")
                    If Normalized(record("Description")) = description Or (Len(orderNumber) > 0 And orders.Exists(orderNumber)) Then Exit For
                    Set record = Nothing
                Next group
            End If
            If Not record Is Nothing Then
                record("Matches") = CLng(record("Matches")) + 1
                basic = CellDate(executionSheet.Cells(rowNumber, basicColumn).Value2)
                completion = CellDate(executionSheet.Cells(rowNumber, completeColumn).Value2)
                If completion > 0 And completion <= reference Then
                    If completion > CDbl(record("Latest")) Then record("Latest") = CDbl(completion)
                    If basic > 0 And Year(completion) = reportYear Then
                        Set periods = record("Periods")
                        frequency = Cadence(CStr(record("Description")), record("Dates"))
                        periods(PeriodKey(basic, frequency)) = True
                    End If
                End If
            End If
        End If
    Next rowNumber
    endRow = analysis.Cells(analysis.Rows.Count, 1).End(xlUp).Row
    If endRow > 1 Then analysis.Range("A2:O" & endRow).ClearContents
    outputRow = 2
    For Each group In plans.Keys
        Set record = plans(group)
        description = CStr(record("Description"))
        frequency = Cadence(description, record("Dates"))
        target = AnnualTarget(frequency, reportYear)
        elapsed = ElapsedTarget(frequency, reportYear, reference)
        Set periods = record("Periods")
        If CLng(record("Matches")) = 0 Then
            Set dates = record("PlanCompletions")
            For Each code In dates
                periods(PeriodKey(CDate(code), frequency)) = True
            Next code
            record("Latest") = record("PlanLatest")
        End If
        completed = WorksheetFunction.Min(target, elapsed, periods.Count)
        latest = CDate(record("Latest"))
        Set dates = record("Dates")
        If latest > 0 Then
            dueDate = FollowingDue(latest, frequency)
        ElseIf dates.Count > 0 Then
            dueDate = dates(1)
            For Each code In dates
                If CDate(code) < dueDate Then dueDate = CDate(code)
            Next code
        Else
            dueDate = 0
        End If
        overdue = 0: priorityStatus = "On track"
        If dueDate > 0 Then
            If dueDate < DateValue(reference) Then overdue = DateDiff("d", dueDate, reference)
            If overdue > 30 Then
                priorityStatus = "Critical"
            ElseIf overdue > 0 Then
                priorityStatus = "Overdue"
            ElseIf DateDiff("d", reference, dueDate) <= 14 Then
                priorityStatus = "Due soon"
            End If
        End If
        machine = "General / site-wide"
        If InStr(description, " - ") > 0 Then machine = Trim$(Split(description, " - ")(0))
        If UCase$(machine) = "GOP" Or UCase$(machine) = "GOPFERT" Then machine = "Gopfert (GOP)"
        analysis.Cells(outputRow, 1).Value2 = machine
        analysis.Cells(outputRow, 2).Value2 = description
        analysis.Cells(outputRow, 3).Value2 = record("Code")
        analysis.Cells(outputRow, 4).Value2 = frequency
        If latest > 0 Then analysis.Cells(outputRow, 5).Value2 = CDbl(latest)
        If dueDate > 0 Then analysis.Cells(outputRow, 6).Value2 = CDbl(dueDate)
        analysis.Cells(outputRow, 7).Value2 = overdue
        analysis.Cells(outputRow, 8).Value2 = target
        analysis.Cells(outputRow, 9).Value2 = elapsed
        analysis.Cells(outputRow, 10).Value2 = completed
        analysis.Cells(outputRow, 11).Formula = "=H" & outputRow & "-J" & outputRow
        analysis.Cells(outputRow, 12).Formula = "=IFERROR(J" & outputRow & "/H" & outputRow & ",0)"
        analysis.Cells(outputRow, 13).Value2 = priorityStatus
        analysis.Cells(outputRow, 14).Value2 = record("Matches")
        analysis.Cells(outputRow, 15).Value2 = record("Calls")
        outputRow = outputRow + 1
    Next group
    analysis.Range("E2:F" & outputRow).NumberFormat = "dd mmm yyyy"
    analysis.Range("L2:L" & outputRow).NumberFormat = "0%"
    If outputRow > 2 Then
        analysis.Range("A1:O" & outputRow - 1).Sort Key1:=analysis.Range("A2"), Order1:=xlAscending, Key2:=analysis.Range("G2"), Order2:=xlDescending, Header:=xlYes
        If analysis.AutoFilterMode Then analysis.AutoFilterMode = False
        analysis.Range("A1:O" & outputRow - 1).AutoFilter
    End If
    board.Range("B11:I30").ClearContents
    board.Range("B36:E55").ClearContents
    Set machineStats = CreateObject("Scripting.Dictionary")
    totalTarget = 0: totalCompleted = 0: totalPlans = 0: overdueCount = 0: soonCount = 0
    boardRow = 11
    For rowNumber = 2 To outputRow - 1
        machine = CStr(analysis.Cells(rowNumber, 1).Value2)
        If Len(machineFilter) = 0 Or UCase$(machineFilter) = "ALL" Or StrComp(machine, machineFilter, vbTextCompare) = 0 Then
            totalPlans = totalPlans + 1
            totalTarget = totalTarget + CLng(analysis.Cells(rowNumber, 8).Value2)
            totalCompleted = totalCompleted + CLng(analysis.Cells(rowNumber, 10).Value2)
            If CLng(analysis.Cells(rowNumber, 7).Value2) > 0 Then overdueCount = overdueCount + 1
            If analysis.Cells(rowNumber, 13).Value2 = "Due soon" Then soonCount = soonCount + 1
            If Not machineStats.Exists(machine) Then
                Set stats = CreateObject("Scripting.Dictionary")
                stats.Add "Completed", 0: stats.Add "Target", 0
                machineStats.Add machine, stats
            End If
            Set stats = machineStats(machine)
            stats("Completed") = CLng(stats("Completed")) + CLng(analysis.Cells(rowNumber, 10).Value2)
            stats("Target") = CLng(stats("Target")) + CLng(analysis.Cells(rowNumber, 8).Value2)
            If boardRow <= 30 Then
                board.Cells(boardRow, 2).Value2 = machine
                board.Cells(boardRow, 3).Value2 = analysis.Cells(rowNumber, 2).Value2
                board.Cells(boardRow, 4).Value2 = analysis.Cells(rowNumber, 4).Value2
                board.Cells(boardRow, 5).Value2 = analysis.Cells(rowNumber, 5).Value2
                board.Cells(boardRow, 6).Value2 = analysis.Cells(rowNumber, 6).Value2
                board.Cells(boardRow, 7).Value2 = analysis.Cells(rowNumber, 7).Value2
                board.Cells(boardRow, 8).Value2 = analysis.Cells(rowNumber, 10).Value2 & "/" & analysis.Cells(rowNumber, 8).Value2
                board.Cells(boardRow, 9).Value2 = analysis.Cells(rowNumber, 13).Value2
                boardRow = boardRow + 1
            End If
        End If
    Next rowNumber
    board.Range("B6").Value2 = totalPlans
    board.Range("D6").Value2 = 0
    If totalTarget > 0 Then board.Range("D6").Value2 = totalCompleted / totalTarget
    board.Range("F6").Value2 = overdueCount
    board.Range("H6").Value2 = soonCount
    board.Range("E11:F30").NumberFormat = "dd mmm yyyy"
    machineRow = 36
    For Each code In machineStats.Keys
        If machineRow > 55 Then Exit For
        Set stats = machineStats(code)
        board.Cells(machineRow, 2).Value2 = code
        board.Cells(machineRow, 3).Value2 = stats("Completed")
        board.Cells(machineRow, 4).Value2 = stats("Target")
        board.Cells(machineRow, 5).Value2 = stats("Completed") / stats("Target")
        machineRow = machineRow + 1
    Next code
    board.Range("E36:E55").NumberFormat = "0%"
    board.PageSetup.PrintArea = "$B$2:$I$55"
    board.PageSetup.Orientation = xlLandscape
    board.PageSetup.FitToPagesWide = 1
    AddRefreshButton board
    UpdateDmsBoard
    UpdateWeeklyReport
    Application.ScreenUpdating = True
    Application.EnableEvents = True
    MsgBox "Analysis updated: " & totalPlans & " activities, " & totalCompleted & "/" & totalTarget & " annual periods.", vbInformation
    Exit Sub
Failed:
    Application.ScreenUpdating = True
    Application.EnableEvents = True
    MsgBox "Refresh failed: " & Err.Description, vbExclamation
End Sub

Private Function DmsDate(ByVal rawValue As Variant) As Date
    Dim text As String, parts() As String
    If IsError(rawValue) Or IsEmpty(rawValue) Then Exit Function
    text = Trim$(CStr(rawValue))
    If InStr(text, "/") > 0 Then
        parts = Split(text, "/")
        If UBound(parts) = 2 Then
            On Error GoTo InvalidDate
            DmsDate = DateSerial(CInt(parts(2)), CInt(parts(0)), CInt(parts(1)))
            Exit Function
        End If
    End If
    DmsDate = CellDate(rawValue)
    Exit Function
InvalidDate:
    DmsDate = 0
End Function

Public Sub UpdateDmsBoard()
    Dim source As Worksheet, board As Worksheet, config As Worksheet
    Dim titleColumn As Long, machineColumn As Long, dateColumn As Long, statusColumn As Long
    Dim fixColumn As Long, notesColumn As Long, safetyColumn As Long, engineerColumn As Long
    Dim rowNumber As Long, outputRow As Long, lastRow As Long, total As Long, completed As Long
    Dim machine As String, filter As String, status As String, added As Date, reference As Date, text As String
    Set source = ThisWorkbook.Worksheets("DMS Input")
    Set board = ThisWorkbook.Worksheets("DMS Board")
    Set config = ThisWorkbook.Worksheets("Settings")
    titleColumn = ColumnNumber(source, "Title")
    machineColumn = ColumnNumber(source, "Machine")
    dateColumn = ColumnNumber(source, "Date added")
    statusColumn = ColumnNumber(source, "Status")
    fixColumn = ColumnNumber(source, "Fix Description")
    notesColumn = ColumnNumber(source, "Engineering Notes")
    safetyColumn = ColumnNumber(source, "Health and Safety")
    engineerColumn = ColumnNumber(source, "Engineer")
    reference = CellDate(config.Range("B4").Value2)
    filter = Trim$(CStr(config.Range("B7").Value2))
    board.Range("B11:I5010").ClearContents
    outputRow = 11
    lastRow = source.Cells(source.Rows.Count, titleColumn).End(xlUp).Row
    For rowNumber = 2 To lastRow
        text = Trim$(CStr(source.Cells(rowNumber, titleColumn).Value2))
        If Len(text) > 0 Then
            machine = Trim$(CStr(source.Cells(rowNumber, machineColumn).Value2))
            If Len(machine) = 0 Then machine = "Unassigned"
            If UCase$(machine) <> "COR" And (Len(filter) = 0 Or UCase$(filter) = "ALL" Or StrComp(filter, machine, vbTextCompare) = 0) Then
                total = total + 1
                status = Trim$(CStr(source.Cells(rowNumber, statusColumn).Value2))
                If Len(status) = 0 Then status = "Not Started"
                If StrComp(status, "Completed", vbTextCompare) = 0 Then completed = completed + 1
                If outputRow <= 5010 Then
                    added = DmsDate(source.Cells(rowNumber, dateColumn).Value2)
                    board.Cells(outputRow, 2).Value2 = machine
                    board.Cells(outputRow, 3).Value2 = text
                    If added > 0 Then board.Cells(outputRow, 4).Value2 = CDbl(added)
                    If added > 0 And status <> "Completed" Then board.Cells(outputRow, 5).Value2 = WorksheetFunction.Max(0, DateDiff("d", added, reference))
                    board.Cells(outputRow, 6).Value2 = status
                    text = Trim$(CStr(source.Cells(rowNumber, fixColumn).Value2))
                    If Len(text) = 0 Then text = Trim$(CStr(source.Cells(rowNumber, notesColumn).Value2))
                    board.Cells(outputRow, 7).Value2 = text
                    board.Cells(outputRow, 8).Value2 = source.Cells(rowNumber, safetyColumn).Value2
                    board.Cells(outputRow, 9).Value2 = source.Cells(rowNumber, engineerColumn).Value2
                    outputRow = outputRow + 1
                End If
            End If
        End If
    Next rowNumber
    board.Range("B6").Value2 = total
    board.Range("D6").Value2 = completed
    board.Range("F6").Value2 = total - completed
    board.Range("H6").Value2 = 0
    If total > 0 Then board.Range("H6").Value2 = completed / total
    board.Range("D11:D5010").NumberFormat = "dd mmm yyyy"
    If outputRow > 11 Then
        board.Range("B10:I" & outputRow - 1).Sort Key1:=board.Range("B11"), Order1:=xlAscending, Key2:=board.Range("E11"), Order2:=xlDescending, Header:=xlYes
        If board.AutoFilterMode Then board.AutoFilterMode = False
        board.Range("B10:I" & outputRow - 1).AutoFilter
    End If
    board.PageSetup.PrintArea = "$B$2:$I$" & WorksheetFunction.Max(11, outputRow - 1)
    board.PageSetup.Orientation = xlLandscape
    board.PageSetup.FitToPagesWide = 1
    AddRefreshButton board
End Sub

Public Sub UpdateWeeklyReport()
    Dim weekly As Worksheet, analysis As Worksheet, config As Worksheet
    Dim startOfWeek As Date, due As Date, rowNumber As Long, outputRow As Long, lastRow As Long
    Dim machine As String, filter As String
    Set weekly = ThisWorkbook.Worksheets("Weekly Report")
    Set analysis = ThisWorkbook.Worksheets("Analysis")
    Set config = ThisWorkbook.Worksheets("Settings")
    startOfWeek = CellDate(config.Range("B6").Value2)
    If startOfWeek = 0 Then Err.Raise vbObjectError + 103, , "Settings!B6 must contain a valid Monday."
    filter = Trim$(CStr(config.Range("B5").Value2))
    weekly.Range("B7:G5006").ClearContents
    outputRow = 7
    lastRow = analysis.Cells(analysis.Rows.Count, 1).End(xlUp).Row
    For rowNumber = 2 To lastRow
        machine = CStr(analysis.Cells(rowNumber, 1).Value2)
        due = CellDate(analysis.Cells(rowNumber, 6).Value2)
        If due >= startOfWeek And due < startOfWeek + 7 Then
            If Len(filter) = 0 Or UCase$(filter) = "ALL" Or StrComp(filter, machine, vbTextCompare) = 0 Then
                If outputRow > 5006 Then Exit For
                weekly.Cells(outputRow, 2).Value2 = machine
                weekly.Cells(outputRow, 3).Value2 = analysis.Cells(rowNumber, 2).Value2
                weekly.Cells(outputRow, 4).Value2 = CDbl(due)
                weekly.Cells(outputRow, 5).Value2 = analysis.Cells(rowNumber, 5).Value2
                weekly.Cells(outputRow, 6).Value2 = analysis.Cells(rowNumber, 4).Value2
                weekly.Cells(outputRow, 7).Value2 = analysis.Cells(rowNumber, 13).Value2
                outputRow = outputRow + 1
            End If
        End If
    Next rowNumber
    weekly.Range("D7:E5006").NumberFormat = "dd mmm yyyy"
    If outputRow > 7 Then
        weekly.Range("B6:G" & outputRow - 1).Sort Key1:=weekly.Range("D7"), Order1:=xlAscending, Header:=xlYes
        If weekly.AutoFilterMode Then weekly.AutoFilterMode = False
        weekly.Range("B6:G" & outputRow - 1).AutoFilter
    End If
    weekly.PageSetup.PrintArea = "$B$2:$G$" & WorksheetFunction.Max(7, outputRow - 1)
    weekly.PageSetup.Orientation = xlLandscape
    weekly.PageSetup.FitToPagesWide = 1
    AddRefreshButton weekly
End Sub

Public Sub ExportMaintenanceDashboardPdf()
    Dim location As String
    If Len(ThisWorkbook.Path) = 0 Then
        MsgBox "Save the workbook before exporting a PDF.", vbExclamation
        Exit Sub
    End If
    location = ThisWorkbook.Path & Application.PathSeparator & "Maintenance_Dashboard_" & Format$(Date, "yyyymmdd") & ".pdf"
    ThisWorkbook.Worksheets("Dashboard").ExportAsFixedFormat Type:=xlTypePDF, Filename:=location
    MsgBox "PDF saved to " & location, vbInformation
End Sub

Public Sub ExportDmsBoardPdf()
    If Len(ThisWorkbook.Path) = 0 Then MsgBox "Save the workbook first.", vbExclamation: Exit Sub
    ThisWorkbook.Worksheets("DMS Board").ExportAsFixedFormat Type:=xlTypePDF, Filename:=ThisWorkbook.Path & Application.PathSeparator & "DMS_Board.pdf"
End Sub

Public Sub ExportWeeklyMaintenancePdf()
    If Len(ThisWorkbook.Path) = 0 Then MsgBox "Save the workbook first.", vbExclamation: Exit Sub
    ThisWorkbook.Worksheets("Weekly Report").ExportAsFixedFormat Type:=xlTypePDF, Filename:=ThisWorkbook.Path & Application.PathSeparator & "Weekly_Maintenance.pdf"
End Sub