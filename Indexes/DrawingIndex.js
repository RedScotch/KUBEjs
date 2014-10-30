(function(KUBE){
    var DrawingIndex = KUBE.AutoLoad().GetNewIndex();
    DrawingIndex.SetNamespace('/Library/Drawing');
    DrawingIndex.SetBaseURL('KUBEjs/Library/Drawing');
    DrawingIndex.SetIndex([
        'Arrow',
        'Bezier',
        'Color',
        'ControlPoint'
    ]);

    KUBE.AutoLoad().AddIndex(DrawingIndex);
}(KUBE));