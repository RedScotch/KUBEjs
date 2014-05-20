(function(KUBE){
	"use strict";
	var UIAutoLoader = KUBE.Loader();	
	KUBE.LoadSingleton('UI',UI,['Ajax','DomJack','StyleJack','ObjectKUBE','ArrayKUBE','DateKUBE']);
	
	UI.prototype.toString = function(){ return '[object '+this.constructor.name+']' };
	function UI(){
		var loadedViews,instances,$uiAPI;
		
		loadedViews = {};
		instances = {};
		$uiAPI = {
			'Load':Load,
			'AutoLoad':AutoLoad,
			'Uses':Uses,
			'CreateRoot':CreateRoot,
			'Create':Create
		}.KUBE().create(UI.prototype);
		
		KUBE.Events($uiAPI);
		UIAutoLoader.SetEmitter($uiAPI);
		
		Load('Root',RootView);
		return $uiAPI;
		
		//View Loading
		function Load(_viewName,_viewClass,_needs){
			if(checkValidView(_viewName, _viewClass)){
				UIAutoLoader.SetAsLoaded(_viewName);
				(KUBE.Is(_needs) === 'array' ? UIAutoLoader.Uses(_needs,function(){ loadView(_viewName,_viewClass); }) : loadView(_viewName,_viewClass));
			}
		}
		
		function checkValidView(_viewName, _viewClass){
			return (KUBE.Is(_viewClass) === 'function' && KUBE.Is(_viewName) === 'string' && !loadedViews[_viewName] ? true : false);
		}

		function loadView(_viewName, _viewClass){
			loadedViews[_viewName] = _viewClass;
			$uiAPI.EmitState(_viewName);
			console.log('UI Loaded: '+_viewName);
		}

		//Autoloading
		function AutoLoad(_map,_basePath,_overwrite){
			UIAutoLoader.Map(_map,_basePath,_overwrite);
		}
		
		function Uses(_dependancies,_callback){
			return UIAutoLoader.Uses(_dependancies,_callback);
		}
		
		//View Creation
		function CreateRoot(_name,_createId,_data){
			if(!instances[_name]){
				instances[_name] = initView(undefined,'Root',_createId,_data);
				instances[_name].Once('delete',function(){
					delete instances[_name];
				});
			}
			return instances[_name];
		}
		
		function Create(_Parent,_type,_createId,_data,_children){
			var $return = (KUBE.Is(loadedViews[_type]) === 'function' ? initView(_Parent,_type,_createId,_data,_children) : undefined);
			if(!$return){
				throw new Error('UI Could not create new view. Has not been loaded');
			}
			return $return;
		}
		
		function initView(_Parent,_type,_createId,_data,_children){
			return new loadedViews[_type](UIView(_Parent,_type,_createId),_createId,_data,_children);
		}		
	}
	
	//This is the coreView that gets passed into each view
	UIView.prototype.toString = function(){ return '[object '+this.constructor.name+']' };
	function UIView(_Parent,_type,_id){
		var Children,$ViewAPI,UpdateResolver;
		Children = [];
		UpdateResolver = KUBE.Patience();
		
		$ViewAPI = {
			'Find':Find,
			'Check':Check,
			'UpdateChildren':UpdateChildren,
			'Delay':Delay,
			'Parent':Parent,
			'Root':Root,
			'Type':Type,
			'Id':Id,
			'DeepRead':DeepRead
		}.KUBE().create(UIView.prototype);
		
		$ViewAPI = KUBE.Events($ViewAPI);
		$ViewAPI.Once('delete',function(){
			Children.KUBE().each(function(_C){
				_C.Delete();
			});
			_Parent = _type = _id = Children = $ViewAPI = UpdateResolver = undefined;
		});
		return $ViewAPI;
		
		function Parent(){
			return _Parent;
		}
		
		function Root(){
			return findRoot($ViewAPI);
		}
		
		//Find logic
		function Find(_comparisonObject){
			return (KUBE.Is(_comparisonObject) === 'object' ? checkRoot(_comparisonObject) || isSelf(_comparisonObject) || inChildren(_comparisonObject) : false);
		}
		
		function Check(_comparisonObject){
			var $return = true;

			if(_comparisonObject.parent && Parent){
				$return = Parent.Check(_comparisonObject.parent); //Does our parent chain match?
			}

			if($return && _comparisonObject.id && _comparisonObject.id !== Id()){
				$return = false; //Does our Id match
			}

			if($return && _comparisonObject.type && _comparisonObject.type !== Type()){
				$return = false; //Does our type match
			}
			return $return;
		}
		
		function checkRoot(_cObj){
			return (_cObj.type === 'root' ? findRoot($ViewAPI) : false);
		}
		
		function isSelf(_cObj){
			return (Check(_cObj) ? $ViewAPI : false);
		}
		
		function inChildren(_cObj){
			var c,$return;
			if(Children.length){
				for(c=0;c<Children.length;c++){
					$return = Children[c].Find(_cObj);
					if($return){
						break;
					}
				}
			}
			return $return;
		}

		function findRoot(_View){
			return (!_View.Parent() ? _View : findRoot(_View.Parent()));
		}
		
		//Process Instruction Logic
		function UpdateChildren(_views,_behavior){
			UpdateResolver.Wait(function(){
				var viewResolver = this;
				if(KUBE.Is(_views) === 'array' && KUBE.Is($ViewAPI.Add) === 'function'){
					_behavior = _behavior || 'loose';
					if(_behavior === 'strict'){
						syncChildren(_views);
					}
					processUpdate(_views,_behavior,viewResolver);
				}
				else if(KUBE.Is(_views) === 'array' && KUBE.Is($ViewAPI.Add) !== 'function' && _views.length){
					throw new Error('Children views cannot be added to View that does not support Add method: '+$ViewAPI.Type());
					viewResolver.resolve();
				}
                else if(KUBE.Is(_views) !== 'array'){
                    throw new Error('Views must be an array!  Passed in a '+KUBE.Is(_views));
                    viewResolver.resolve();
                }
				else{
					viewResolver.resolve();
				}
			});
						
			return $ViewAPI;
		}
		
		function Delay(_f){
			if(KUBE.Is(_f) === 'function'){
				UpdateResolver.Wait(function(){
					_f();
					this.resolve();
				});
			}
			return $ViewAPI;
		}
		
		function processUpdate(_views,_behavior,viewResolver){
			//Create/Update only
			var createArray,vCount,typeIncrement,deleteArray,skipVar;
			createArray = [];
			deleteArray = [];
			typeIncrement = {};
			
			for(vCount = 0;vCount<_views.length;vCount++){
				if(!typeIncrement[_views[vCount].type]){
					typeIncrement[_views[vCount].type] = 0;
				}
				
				skipVar = childMatchUpdate(_views[vCount],_behavior,typeIncrement[_views[vCount].type]);
				if(skipVar === false){
					createArray.push(_views[vCount]);
				}
				else{
					typeIncrement[_views[vCount].type] = skipVar;
				}
			}
			
			if(createArray.length){
				createChildren(createArray,viewResolver);
			}
			else{
				viewResolver.resolve();
			}
		}

		function createFreezeTimer(){
			var timeoutObj = setTimeout(function(){ KUBE.Ajax('Action').Emit('freeze',true); },250);
			this.resolve(timeoutObj);			
		}
		
		function yieldChildren(i,_views,timeoutObj,resolver,choke){
			var newChild,Child;
			choke = choke || 1;
			resolver = resolver || this;
			newChild = _views[i];
			if(KUBE.Is(newChild) === 'object'){
				try{
					Child = createNewChildView(newChild);
				}
				catch(E){
					if(E.message === 'UI Could not create new view. Has not been loaded' && choke < 50){
						KUBE.UI().Uses([newChild.type],function(){
							yieldChildren(i,_views,timeoutObj,resolver,++choke);
						});
					}
					else{
						throw E;
						(resolver.last() ? resolver.resolve(timeoutObj) : resolver.next());
					}
				}
			}
			
			if(Child){
				if(KUBE.Is(newChild.views) === 'array'){
					Child.UpdateChildren(newChild.views);
				}
				if($ViewAPI.Add(Child,_views.length)){
					Children.push(Child);
					Child.Once('delete',function(){
						deleteChild(Child);
					});
				}
				else{
					Child.Delete();
				}
				(resolver.last() ? resolver.resolve(timeoutObj) : resolver.next());
			}
		}
		
		function finishUpdate(_timeoutObj){
			clearTimeout(_timeoutObj);
			KUBE.Ajax('Action').Emit('freeze',false);
			if(KUBE.Is($ViewAPI.AddFinish) === 'function'){
				$ViewAPI.AddFinish();
			}
		}
		
		function createChildren(_createArray,viewResolver){
			var P = KUBE.Patience();
			P.Wait(createFreezeTimer);
			P.LazyLoop(_createArray,yieldChildren);
			P.Wait(function(_tObj){
				finishUpdate(_tObj);
				this.resolve();
				viewResolver.resolve();
			});
		}
		
		function syncChildren(_matchArray){
			var c,v,safe,match,OldChildren;
			OldChildren = Children;
			Children = [];
			safe = {};
			match = {};
			
			for(c=0;c<OldChildren.length;c++){
				for(v=0;v<_matchArray.length;v++){
					if(!safe[v] && !match[c]){
						if(OldChildren[c].Check(_matchArray[v])){
							safe[v] = true;
							match[c] = true;
							Children.push(OldChildren[c]);
							break;
						}
					}
				}
			}
			
			for(c=0;c<OldChildren.length;c++){
				if(!match[c]){
					OldChildren[c].Delete();
				}
			}
		}
		
		function deleteChild(_Child){
			var c,OldChildren;
			OldChildren = Children;
			Children = [];
			
			for(c=0;c<OldChildren.length;c++){
				if(OldChildren[c] !== _Child){
					Children.push(OldChildren[c]);
				}
			}
		}
		
		function childMatchUpdate(_view,_behavior,_skip){
			var cObj,cCount,skipCheck,$return;
			
			//Init vars
			_skip = _skip || 0;
			skipCheck = 0;
			cObj = {'type':_view.type,'id':_view.id};			
			$return = false;
			
			for(cCount=0;cCount<Children.length;cCount++){
				if(Children[cCount].Check(cObj)){
					if(cObj.id){
						updateChildView(Children[cCount],_view.data,_view.views,_behavior);
						$return = _skip;
						break;
					}
					else{
						if(_skip > skipCheck){
							skipCheck++;
						}
						else{
							updateChildView(Children[cCount],_view.data,_view.views,_behavior);
							$return = _skip+1;
							break;
						}						
					}
				}
			}
			return $return;
		}
		
		function createNewChildView(viewObject){
			//_Parent,_type,_createId,_data
			var numChildren = (KUBE.Is(viewObject.views) === 'array' && viewObject.views.length ? viewObject.views.length : 0);
			return KUBE.UI().Create($ViewAPI,viewObject.type,viewObject.id,viewObject.data,numChildren);
		}
		
		function updateChildView(_ChildView,_data,_views,_behavior){
			_ChildView.Update(_data);
			if(KUBE.Is(_views) === 'array'){
				_ChildView.UpdateChildren(_views,_behavior);
			}
		}
				
		//Core information
		function Type(){
			return String(_type); //).toLowerCase();
		}
		
		function Id(){
			return _id;
		}
		
		function DeepRead(){
			return {
				'type':Type(),
				'id':Id(),
				'data':$ViewAPI.Read(),
				'views':readChildren()
			};
		}
		
		function readChildren(){
			var $return = [];
			if(Children.length){
				Children.KUBE().each(function(_Child){
					$return.push(_Child.DeepRead());
				});
			}
			return $return;
		}
	}
	
	//This is the RootView
	function RootView(CoreView,id,data){
		var View,SJ,DJ,SendHandler,responseCall,sharedStyles,width,height;
		sharedStyles = {};
		
		SJ = KUBE.StyleJack;
		DJ = KUBE.DomJack;
		
		CoreView.KUBE().merge({
			'Get':Get,
			'Read':Read,
			'Update':Update,
			'Delete':Delete,
			'Add':Add,
			'Send':Send,
			'SetSendHandler':SetSendHandler,
			'AddSharedStyle':AddSharedStyle,
			'GetSharedStyles':GetSharedStyles,
			'IsSharedStyle':IsSharedStyle,
			'Width':Width,
			'Height':Height,
			'Resize':Resize
		});		
		create();
		return CoreView;

		//Public
		function Get(){
			return View;
		}
		
		function Read(){ 
			return {}; 
		}
		
		function Update(){
			return false; 
		}
		
		function Delete(){ 
			var $return = false;
			if(View){
				View.Delete();
				$return = true;
			}
			return $return; 
		}
		
		function Add(_NewView){
			var $return = false;
			if(KUBE.Is(_NewView,true) === 'UIView'){
				View.Append(_NewView.Get());
				$return = true;
			}
			return $return;
		}
		
		function Send(_actionObj,_f){
			//This has the ability to communicate directly with the View that is sending the request, otherwise instructions are processed accordingly
			SendHandler.Send(_actionObj,true);
			if(KUBE.Is(_f) === 'function'){
				responseCall = _f;
			}
		}
		
		function SetSendHandler(_Send){
			if(KUBE.Is(_Send,true) === 'Ajax'){
				SendHandler = _Send;
				SendHandler.On('response',handleInstructions);
				SendHandler.On('error',handleAjaxError);
			}
			else{
				throw new Error('Set send handler failed. Not an KUBE Ajax Object?');
			}
			return CoreView;
		}
		
		function AddSharedStyle(_className){
			switch(KUBE.Is(_className)){
				case 'array':
					_className.KUBE().each(function(_className){
						AddSharedStyle(_className);
					});
					break;
					
				case 'string':
					sharedStyles[_className] = _className;
					break;
			}
			return CoreView;
		}
		
		function GetSharedStyles(){
			return sharedStyles.KUBE().copy();
		}
		
		function IsSharedStyle(_className){
			return (sharedStyles[_className] ? true : false);
		}
		
		function Width(){
			return width;
		}
		
		function Height(){
			return height;
		}
		
		function Resize(){
			//Finish this. Animated gif, or animated css?
			var blackOut,resizePause;
			DJ().Resize(function(){
				if(resizePause){
					clearTimeout(resizePause);
				}
				else{
					//First time it's fired, trigger black out
				}
				resizePause = setTimeout(function(){
					//Call resize on UI
					setTimeout(function(){
						//And restore views
					},1000);
				},1000);
			});
		}

		//Private methods
		function handleAjaxError(_e){
            console.log('handleAjaxError called in UI:',_e.message);
			alert(_e.message);
            //debugger;
		}
		
		function handleInstructions(_response){
			var rCall;
			if(KUBE.Is(_response) === 'object'){
				if(responseCall){
					rCall = responseCall;
					responseCall = undefined;
					try{
						rCall(_response.response);
					}
					catch(E){
						//Response call resulted in javascript error. PROGRAM MOAR BETTAR!?
						throw E;
					}
				}
				
				if(_response.autoLoad){
					processAutoLoad(_response.autoLoad);
				}
				
				if(_response.instructions){
					switch(KUBE.Is(_response.instructions)){
						case 'array':
							_response.instructions.KUBE().each(processInstructions);
							break;
							
						case 'object':
							processInstructions(_response.instructions);
							break;
					}
				}
			}
		}
		
		function processInstructions(_instructions){
			var FoundView;
			if(KUBE.Is(_instructions) === 'object'){
				//Autoload?
				FoundView = CoreView.Find(_instructions.find);
				if(FoundView){
					if(KUBE.Is(_instructions.data) !== 'null'){
						debugger;
						FoundView.Update(_instructions.data);
					}

					if(KUBE.Is(_instructions.views) === 'array'){
						FoundView.UpdateChildren(_instructions.views,_instructions.behavior);
					}
				}
			}
		}	

		//This allows for autoloading of UI components
		function autoLoad(_autoLoadInstructions){
			if(KUBE.Is(_autoLoadInstructions) === 'object'){
				KUBE.UI().AutoLoad(_autoLoadInstructions.views,_autoLoadInstructions.basePath);
			}
		}

		function processAutoLoad(_autoLoad){
			if(KUBE.Is(_autoLoad) === 'array'){
				_autoLoad.KUBE().each(autoLoad);
			}
		}
		
		//For the view
		function create(){
			if(!View){
				initRootView();
				initRootStyle();
				CoreView.EmitState('drawFinish');
			}
		}
		
		function initRootView(){
			if(KUBE.Is(id) === 'string'){
				View = DJ('#'+id);
			}
			else{
				View = DJ(document.body);
				id = 'body';
			}
			assignDimensions();
		}
		
		function initRootStyle(){
            var rootId = (id == 'body') ? 'body' : '#' + id;
			SJ('*').Margin(0).Padding(0);//.Box().Sizing('border-box');
            SJ(rootId).Overflow('hidden');//.Set(['hidden','auto']); //This is DD messing around, Probably not the right place.
			SJ('.rootClear').Position('relative').Width('100%').Height(0).Clear('both');
		}
		
		function assignDimensions(){
			(View.GetNode() === document.body ? assignWindowDimensions() : assignNodeDimensions());
		}
		
		function assignWindowDimensions(){
			width = DJ().WindowWidth();
			height = DJ().WindowHeight();			
		}
		
		function assignNodeDimensions(){
			var r = View.Rect();
			width = r.width;
			height = r.height;
		}
	}	
}(KUBE));

//var instructions = 
//{
//	'loadViews':[], //Autoload?
//	'find':{}, //Find the parent
//	'behavior':'loose/strict/inherited', //loose/strict (loose creates/updates only, strict creates/updates/removes)
//	'data': {},
//	'views':[
//		{
//			'type':'xxx',
//			'id':'xxx',
//			'data':{},
//			'behavior':'loose/strict/inherited',
//			'views':[
//				
//			]
//		}
//	]
//};
//
//RootView = UI.CreateRoot('Node/Id');
//FoundView = RootView.Find(find);
//FoundView.Update(data);
//FoundView.UpdateChildren(views,behavior);



//
//var View = UI.Find(find);
//View.Update(data);
//View.UpdateChildren(views,behavior);