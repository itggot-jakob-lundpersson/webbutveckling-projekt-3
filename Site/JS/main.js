function menuToggle(event){
    let menu = document.querySelector("menu")
    let klass = document.getElementsByClassName("klass")
        menu.classList.toggle("activate_menu")
        klass.classList.toggle("activate_menu")
        klass.id.toggle("activate_menu")
    }

    