      function createCycleTools() {
        const plans={single:null,'25-5':{focus:25,rest:5,rounds:4},'50-10':{focus:50,rest:10,rounds:2}};
        const validDuration=value=>Number.isInteger(value)&&value>=0&&value<=180;
        function initial(plan='single',singleDuration=0) {
          if(!Object.prototype.hasOwnProperty.call(plans,plan)||!validDuration(singleDuration))throw Error('Plan de sesión inválido.');
          return {plan,round:1,phase:'focus',completed:false,singleDuration};
        }
        function normalize(value) {
          if(!value||typeof value!=='object'||!Object.prototype.hasOwnProperty.call(plans,value.plan)||!validDuration(value.singleDuration)||!Number.isInteger(value.round)||!['focus','rest'].includes(value.phase)||typeof value.completed!=='boolean')return null;
          if(value.plan==='single')return value.round===1&&value.phase==='focus'&&!value.completed?initial('single',value.singleDuration):null;
          const plan=plans[value.plan];
          if(value.round<1||value.round>plan.rounds||(value.phase==='rest'&&value.round===plan.rounds))return null;
          return {plan:value.plan,round:value.round,phase:value.phase,completed:value.completed,singleDuration:value.singleDuration};
        }
        function duration(state) {return state.plan==='single'?state.singleDuration:plans[state.plan][state.phase];}
        function next(state) {
          const valid=normalize(state);if(!valid)throw Error('Estado de ciclo inválido.');
          if(valid.plan==='single'||!valid.completed)return valid;
          const plan=plans[valid.plan];
          if(valid.phase==='focus'&&valid.round===plan.rounds)return initial(valid.plan,valid.singleDuration);
          return {...valid,phase:valid.phase==='focus'?'rest':'focus',round:valid.phase==='rest'?valid.round+1:valid.round,completed:false};
        }
        function complete(state) {
          return state.plan==='single'?state:{...state,completed:true};
        }
        return {plans,initial,normalize,duration,next,complete,validDuration};
      }
      function isSilentRestState(state,restSound) {
        return Boolean(state&&['25-5','50-10'].includes(state.plan)&&state.phase==='rest'&&restSound==='silent');
      }
      function sessionExtension(plan,duration,elapsedMs) {
        if(plan!=='single'||!Number.isInteger(duration)||duration<1||duration>=180||!Number.isFinite(elapsedMs)||elapsedMs<0||elapsedMs>=duration*60000)return null;
        const added=Math.min(5,180-duration);
        return {duration:duration+added,added};
      }
export {createCycleTools,isSilentRestState,sessionExtension};
